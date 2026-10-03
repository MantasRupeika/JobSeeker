const fs = require('fs');
const path = require('path');
const vm = require('vm');

const scriptSource = fs.readFileSync(
  path.resolve(__dirname, '../../../frontend/job-search.js'),
  'utf8'
);

const FILTER_DEBOUNCE_WAIT_MS = 300;

function createClassList(initialValue = '') {
  const classes = new Set(
    String(initialValue)
      .split(/\s+/)
      .map((value) => value.trim())
      .filter(Boolean)
  );

  return {
    add(...names) {
      names.filter(Boolean).forEach((name) => classes.add(name));
    },
    remove(...names) {
      names.filter(Boolean).forEach((name) => classes.delete(name));
    },
    toggle(name, force) {
      if (force === true) {
        classes.add(name);
        return true;
      }

      if (force === false) {
        classes.delete(name);
        return false;
      }

      if (classes.has(name)) {
        classes.delete(name);
        return false;
      }

      classes.add(name);
      return true;
    },
    contains(name) {
      return classes.has(name);
    },
    toString() {
      return Array.from(classes).join(' ');
    }
  };
}

class FakeElement {
  constructor(tagName, options = {}) {
    this.tagName = String(tagName || 'div').toUpperCase();
    this.id = options.id || '';
    this._className = options.className || '';
    this.classList = createClassList(this._className);
    this.attributes = { ...(options.attributes || {}) };
    this.children = [];
    this.listeners = {};
    this.textContent = options.textContent || '';
    this.value = options.value || '';
    this.disabled = Boolean(options.disabled);
    this.hidden = Boolean(options.hidden);
    this._innerHTML = options.innerHTML || '';
  }

  get className() {
    return this.classList.toString();
  }

  set className(value) {
    this._className = String(value || '');
    this.classList = createClassList(this._className);
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(value) {
    this._innerHTML = String(value || '');
    this.children = [];
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);

    if (name === 'class') {
      this.className = value;
    }

    if (name === 'id') {
      this.id = String(value);
    }
  }

  getAttribute(name) {
    return this.attributes[name];
  }

  appendChild(child) {
    if (child && child.isFragment) {
      this.children.push(...child.children);
      return child;
    }

    this.children.push(child);
    return child;
  }

  addEventListener(type, handler) {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }

    this.listeners[type].push(handler);
  }

  dispatchEvent(event) {
    const normalizedEvent = typeof event === 'string' ? { type: event } : event;
    const handlers = this.listeners[normalizedEvent.type] || [];

    handlers.forEach((handler) => handler({ ...normalizedEvent, target: this }));
  }

  querySelector(selector) {
    return findFirstMatch(this, selector);
  }

  querySelectorAll(selector) {
    return findAllMatches(this, selector);
  }
}

function matchesSelector(node, selector) {
  if (!node) {
    return false;
  }

  if (selector.startsWith('.')) {
    return node.classList && node.classList.contains(selector.slice(1));
  }

  const dataJobMatch = selector.match(/^\[data-job="([^"]+)"\]$/);
  if (dataJobMatch) {
    return node.attributes && node.attributes['data-job'] === dataJobMatch[1];
  }

  return false;
}

function findFirstMatch(node, selector) {
  if (matchesSelector(node, selector)) {
    return node;
  }

  for (const child of node.children || []) {
    const match = findFirstMatch(child, selector);
    if (match) {
      return match;
    }
  }

  return null;
}

function findAllMatches(node, selector, results = []) {
  if (matchesSelector(node, selector)) {
    results.push(node);
  }

  for (const child of node.children || []) {
    findAllMatches(child, selector, results);
  }

  return results;
}

function createFragment() {
  return {
    isFragment: true,
    children: [],
    appendChild(child) {
      this.children.push(child);
      return child;
    }
  };
}

function createCardClone() {
  const card = new FakeElement('article', { className: 'job-card' });
  const title = new FakeElement('h2', { className: 'job-title' });
  const company = new FakeElement('span', { attributes: { 'data-job': 'company' } });
  const location = new FakeElement('span', { attributes: { 'data-job': 'location' } });
  const salary = new FakeElement('span', { attributes: { 'data-job': 'salary' } });
  const saveButton = new FakeElement('button', { attributes: { 'data-job': 'save-button' } });

  card.children = [title, company, location, salary, saveButton];
  return card;
}

function createJobSearchEnvironment(jobData) {
  const elements = new Map();
  const jobGrid = new FakeElement('section', { id: 'jobGrid' });
  const jobCardTemplate = {
    id: 'jobCardTemplate',
    content: {
      cloneNode() {
        return createCardClone();
      }
    }
  };
  const jobsStatus = new FakeElement('p', { id: 'jobsStatus' });
  const jobsCount = new FakeElement('p', { id: 'jobsCount' });
  const jobTypeFilter = new FakeElement('select', { id: 'jobTypeFilter' });
  const locationFilter = new FakeElement('input', { id: 'locationFilter' });
  const salaryMinFilter = new FakeElement('input', { id: 'salaryMinFilter' });
  const salaryMaxFilter = new FakeElement('input', { id: 'salaryMaxFilter' });

  [jobGrid, jobsStatus, jobsCount, jobTypeFilter, locationFilter, salaryMinFilter, salaryMaxFilter].forEach(
    (element) => elements.set(element.id, element)
  );
  elements.set('jobCardTemplate', jobCardTemplate);

  function applyFiltersFromUrl(urlValue) {
    const parsedUrl = new URL(urlValue);
    const params = parsedUrl.searchParams;
    const jobType = String(params.get('jobType') || '').trim().toLowerCase();
    const location = String(params.get('location') || '').trim().toLowerCase();
    const salaryMin = params.get('salaryMin') !== null ? Number(params.get('salaryMin')) : null;
    const salaryMax = params.get('salaryMax') !== null ? Number(params.get('salaryMax')) : null;

    return jobData.filter((job) => {
      const jobTypeValue = String(job.jobType || '').trim().toLowerCase();
      const locationValue = String(job.location || '').trim().toLowerCase();
      const min = Number(job.salaryMin);
      const max = Number(job.salaryMax);
      const hasMin = Number.isFinite(min);
      const hasMax = Number.isFinite(max);
      const rangeMin = hasMin ? min : max;
      const rangeMax = hasMax ? max : min;

      if (jobType && jobTypeValue !== jobType) {
        return false;
      }

      if (location && !locationValue.includes(location)) {
        return false;
      }

      if (salaryMin !== null && Number.isFinite(salaryMin) && rangeMax < salaryMin) {
        return false;
      }

      if (salaryMax !== null && Number.isFinite(salaryMax) && rangeMin > salaryMax) {
        return false;
      }

      return true;
    });
  }

  const fetchMock = jest.fn(async (urlValue) => {
    const jobs = applyFiltersFromUrl(urlValue);

    return {
      ok: true,
      json: async () => ({
        jobs,
        pagination: {
          total: jobs.length,
          page: 1,
          pageSize: 100,
          totalPages: 1
        }
      })
    };
  });

  const localStorageState = new Map();
  const localStorage = {
    getItem(key) {
      return localStorageState.has(key) ? localStorageState.get(key) : null;
    },
    setItem(key, value) {
      localStorageState.set(key, String(value));
    },
    removeItem(key) {
      localStorageState.delete(key);
    },
    clear() {
      localStorageState.clear();
    }
  };

  const document = {
    getElementById(id) {
      return elements.get(id) || null;
    },
    createElement(tagName) {
      return new FakeElement(tagName);
    },
    createDocumentFragment() {
      return createFragment();
    }
  };

  jobGrid.appendChild = function appendChild(child) {
    if (child && child.isFragment) {
      this.children = child.children.slice();
      return child;
    }

    this.children.push(child);
    return child;
  };

  jobGrid.innerHTML = '';
  jobTypeFilter.appendChild = function appendChild(child) {
    this.children.push(child);
    return child;
  };

  const window = {
    API_BASE_URL: 'http://localhost:3000',
    document,
    localStorage,
    location: { protocol: 'file:' },
    setTimeout,
    clearTimeout,
    console,
    URL,
    URLSearchParams,
    Promise,
    Date
  };

  window.window = window;

  const context = vm.createContext({
    window,
    document,
    localStorage,
    fetch: fetchMock,
    setTimeout,
    clearTimeout,
    console,
    URL,
    URLSearchParams,
    Promise,
    Date
  });

  vm.runInContext(scriptSource, context);

  return {
    fetchMock,
    jobGrid,
    jobsStatus,
    jobsCount,
    jobTypeFilter,
    locationFilter,
    salaryMinFilter,
    salaryMaxFilter,
    wait(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }
  };
}

function readRenderedCard(jobGrid, index = 0) {
  const card = jobGrid.children[index];
  if (!card) {
    return null;
  }

  return {
    title: card.querySelector('.job-title')?.textContent,
    company: card.querySelector('[data-job="company"]')?.textContent,
    location: card.querySelector('[data-job="location"]')?.textContent,
    salary: card.querySelector('[data-job="salary"]')?.textContent
  };
}

describe('job-search page integration-style behavior', () => {
  const baseJobs = [
    {
      id: 1,
      title: 'Frontend Developer',
      company: 'BrightApps',
      location: 'Vilnius',
      salaryMin: 2400,
      salaryMax: 3200,
      jobType: 'full-time',
      url: 'https://example.com/job/1',
      scrapedAt: '2026-04-03 10:00:00'
    },
    {
      id: 2,
      title: 'Backend Engineer',
      company: 'CloudForge',
      location: 'Kaunas',
      salaryMin: 1800,
      salaryMax: 2500,
      jobType: 'contract',
      url: 'https://example.com/job/2',
      scrapedAt: '2026-04-03 10:00:00'
    },
    {
      id: 3,
      title: 'QA Specialist',
      company: 'TestNest',
      location: 'Remote',
      salaryMin: 1900,
      salaryMax: 2600,
      jobType: 'full-time',
      url: 'https://example.com/job/3',
      scrapedAt: '2026-04-03 10:00:00'
    }
  ];

  test('loads jobs from the API and renders cards from the database-backed payload', async () => {
    const env = createJobSearchEnvironment(baseJobs);

    await env.wait(0);
    await env.wait(0);

    expect(env.fetchMock).toHaveBeenCalledTimes(1);
    expect(env.fetchMock.mock.calls[0][0]).toContain('/api/jobs');
    expect(env.fetchMock.mock.calls[0][0]).toContain('page=1');
    expect(env.fetchMock.mock.calls[0][0]).toContain('pageSize=100');
    expect(env.jobGrid.children).toHaveLength(3);
    expect(env.jobsCount.textContent).toBe('3 jobs found');

    expect(readRenderedCard(env.jobGrid)).toEqual({
      title: 'Frontend Developer',
      company: 'BrightApps',
      location: 'Vilnius',
      salary: '2400 - 3200 EUR / month'
    });
  });

  test('refetches and rerenders in real time when filters change', async () => {
    const env = createJobSearchEnvironment(baseJobs);

    await env.wait(0);
    await env.wait(0);

    env.jobTypeFilter.value = 'full-time';
    env.locationFilter.value = 'Vilnius';
    env.salaryMinFilter.value = '2000';
    env.salaryMaxFilter.value = '3500';

    env.jobTypeFilter.dispatchEvent('change');
    await env.wait(FILTER_DEBOUNCE_WAIT_MS + 50);
    await env.wait(0);
    await env.wait(0);

    expect(env.fetchMock).toHaveBeenCalledTimes(2);
    const requestUrl = new URL(env.fetchMock.mock.calls[1][0]);
    expect(requestUrl.searchParams.get('jobType')).toBe('full-time');
    expect(requestUrl.searchParams.get('location')).toBe('Vilnius');
    expect(requestUrl.searchParams.get('salaryMin')).toBe('2000');
    expect(requestUrl.searchParams.get('salaryMax')).toBe('3500');

    expect(env.jobGrid.children).toHaveLength(1);
    expect(env.jobsCount.textContent).toBe('1 jobs found');
    expect(readRenderedCard(env.jobGrid)).toEqual({
      title: 'Frontend Developer',
      company: 'BrightApps',
      location: 'Vilnius',
      salary: '2400 - 3200 EUR / month'
    });
  });

  test('shows validation error and skips refetch when salary range is invalid', async () => {
    const env = createJobSearchEnvironment(baseJobs);

    await env.wait(0);
    await env.wait(0);

    env.salaryMinFilter.value = '4000';
    env.salaryMaxFilter.value = '1000';
    env.salaryMinFilter.dispatchEvent('input');

    await env.wait(FILTER_DEBOUNCE_WAIT_MS + 50);
    await env.wait(0);

    expect(env.fetchMock).toHaveBeenCalledTimes(1);
    expect(env.jobsStatus.textContent).toBe('Minimum salary cannot be greater than maximum salary.');
    expect(env.jobsStatus.classList.contains('is-error')).toBe(true);
    expect(env.jobGrid.children).toHaveLength(0);
  });
});
