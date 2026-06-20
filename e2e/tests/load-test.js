import http from "k6/http";
import { check, group, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

const API_BASE_URL = __ENV.API_BASE_URL || "http://localhost:8000";
const FRONTEND_BASE_URL = __ENV.FRONTEND_BASE_URL || "http://localhost:5173";
const FRONTEND_HOST_HEADER = __ENV.FRONTEND_HOST_HEADER || "localhost:5173";
const ADMIN_EMAIL = __ENV.E2E_ADMIN_EMAIL || "admin.seed@example.com";
const ADMIN_PASSWORD = __ENV.E2E_ADMIN_PASSWORD || "SeedPassword123!";
const REGULAR_EMAIL = __ENV.E2E_REGULAR_EMAIL || "user.seed@example.com";
const REGULAR_PASSWORD = __ENV.E2E_REGULAR_PASSWORD || "SeedPassword123!";

const SEED = {
  adminUserId: 10001,
  regularUserId: 10002,
  buildingId: 20001,
  roomId: 20002,
  cabinetId: 20003,
  electronicsCategoryId: 30001,
  computersCategoryId: 30002,
  accessoriesCategoryId: 30003,
  laptopUuid: "00000000-0000-0000-0000-000000040001",
  projectorUuid: "00000000-0000-0000-0000-000000040002",
};

const failures = new Rate("pz_functional_failures");
const crudItems = new Counter("pz_crud_items_created");
const searchLatency = new Trend("pz_search_latency", true);
const crudLatency = new Trend("pz_crud_latency", true);

export const options = {
  scenarios: {
    read_paths: {
      executor: "constant-vus",
      vus: Number(__ENV.E2E_READ_VUS || 8),
      duration: __ENV.E2E_READ_DURATION || "1m",
      exec: "readPaths",
    },
    admin_paths: {
      executor: "constant-vus",
      vus: Number(__ENV.E2E_ADMIN_VUS || 3),
      duration: __ENV.E2E_ADMIN_DURATION || "1m",
      exec: "adminPaths",
    },
    crud_paths: {
      executor: "constant-arrival-rate",
      rate: Number(__ENV.E2E_CRUD_RATE || 4),
      timeUnit: "1s",
      duration: __ENV.E2E_CRUD_DURATION || "45s",
      preAllocatedVUs: Number(__ENV.E2E_CRUD_PREALLOCATED_VUS || 6),
      maxVUs: Number(__ENV.E2E_CRUD_MAX_VUS || 12),
      exec: "crudPaths",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<750", "p(99)<1500"],
    "http_req_duration{flow:read}": ["p(95)<500"],
    "http_req_duration{flow:admin}": ["p(95)<650"],
    "http_req_duration{flow:crud}": ["p(95)<900"],
    pz_search_latency: ["p(95)<500"],
    pz_crud_latency: ["p(95)<900"],
    pz_functional_failures: ["rate<0.01"],
  },
};

function jsonHeaders(token = null) {
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function requestOptions(token, flow, endpoint) {
  return {
    headers: jsonHeaders(token),
    tags: { flow, endpoint },
  };
}

function recordCheck(response, condition, name) {
  const ok = check(response, { [name]: condition });
  failures.add(!ok);
  return ok;
}

function login(email, password) {
  const response = http.post(
    `${API_BASE_URL}/auth/login`,
    JSON.stringify({ email, password }),
    requestOptions(null, "auth", "login"),
  );

  recordCheck(response, (res) => res.status === 200 && Boolean(res.json("access_token")), "login returns access token");
  return response.json("access_token");
}

function json(response) {
  try {
    return response.json();
  } catch (e) {
    return {};
  }
}

export function setup() {
  const ready = http.get(`${API_BASE_URL}/ready`, { tags: { flow: "health", endpoint: "ready" } });
  recordCheck(ready, (res) => res.status === 200, "api is ready");

  let frontend = null;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    frontend = http.get(FRONTEND_BASE_URL, {
      headers: { Host: FRONTEND_HOST_HEADER },
      tags: { flow: "frontend", endpoint: "root" },
    });
    if (frontend.status === 200) {
      break;
    }
    sleep(1);
  }
  recordCheck(frontend, (res) => res.status === 200, "frontend root is served");

  return {
    adminToken: login(ADMIN_EMAIL, ADMIN_PASSWORD),
    regularToken: login(REGULAR_EMAIL, REGULAR_PASSWORD),
  };
}

export function readPaths(data) {
  const token = data.regularToken;

  group("inventory search and details", () => {
    const list = http.get(`${API_BASE_URL}/items?limit=20&page=1`, {
      headers: jsonHeaders(token),
      tags: { flow: "read", endpoint: "items.list" },
    });
    searchLatency.add(list.timings.duration);
    recordCheck(list, (res) => res.status === 200 && Array.isArray(res.json("items")), "items list works");

    const search = http.get(`${API_BASE_URL}/items?name=Laptop&limit=10&page=1`, {
      headers: jsonHeaders(token),
      tags: { flow: "read", endpoint: "items.search.name" },
    });
    searchLatency.add(search.timings.duration);
    recordCheck(search, (res) => res.status === 200, "items name search works");

    const filtered = http.get(`${API_BASE_URL}/items?category_id=${SEED.computersCategoryId}&status=available&limit=10&page=1`, {
      headers: jsonHeaders(token),
      tags: { flow: "read", endpoint: "items.search.filters" },
    });
    searchLatency.add(filtered.timings.duration);
    recordCheck(filtered, (res) => res.status === 200, "items filtered search works");

    const details = http.get(`${API_BASE_URL}/items/${SEED.laptopUuid}`, {
      headers: jsonHeaders(token),
      tags: { flow: "read", endpoint: "items.details" },
    });
    recordCheck(details, (res) => res.status === 200 && res.json("id") === SEED.laptopUuid, "item details work");

    const history = http.get(`${API_BASE_URL}/items/${SEED.laptopUuid}/history`, {
      headers: jsonHeaders(token),
      tags: { flow: "read", endpoint: "items.history" },
    });
    recordCheck(history, (res) => res.status === 200 && Array.isArray(res.json("entries")), "item history works");
  });

  group("category and location browsing", () => {
    const categories = http.get(`${API_BASE_URL}/categories?limit=20&page=1`, {
      headers: jsonHeaders(token),
      tags: { flow: "read", endpoint: "categories.list" },
    });
    searchLatency.add(categories.timings.duration);
    recordCheck(categories, (res) => res.status === 200 && Array.isArray(res.json("categories")), "categories list works");

    const categoryItems = http.get(`${API_BASE_URL}/categories/${SEED.electronicsCategoryId}/items?limit=20&page=1`, {
      headers: jsonHeaders(token),
      tags: { flow: "read", endpoint: "categories.items" },
    });
    searchLatency.add(categoryItems.timings.duration);
    recordCheck(categoryItems, (res) => res.status === 200 && Array.isArray(res.json("items")), "category items work");

    const count = http.get(`${API_BASE_URL}/categories/${SEED.electronicsCategoryId}/items/count`, {
      headers: jsonHeaders(token),
      tags: { flow: "read", endpoint: "categories.items.count" },
    });
    recordCheck(count, (res) => res.status === 200 && Number.isInteger(res.json("count")), "category count works");

    const locations = http.get(`${API_BASE_URL}/locations?limit=20&page=1`, {
      headers: jsonHeaders(token),
      tags: { flow: "read", endpoint: "locations.list" },
    });
    searchLatency.add(locations.timings.duration);
    recordCheck(locations, (res) => res.status === 200 && Array.isArray(res.json("locations")), "locations list works");

    const childLocations = http.get(`${API_BASE_URL}/locations?parent_id=${SEED.buildingId}&limit=20&page=1`, {
      headers: jsonHeaders(token),
      tags: { flow: "read", endpoint: "locations.children" },
    });
    searchLatency.add(childLocations.timings.duration);
    recordCheck(childLocations, (res) => res.status === 200, "location children filter works");

    const locationDetails = http.get(`${API_BASE_URL}/locations/${SEED.cabinetId}`, {
      headers: jsonHeaders(token),
      tags: { flow: "read", endpoint: "locations.details" },
    });
    recordCheck(locationDetails, (res) => res.status === 200 && res.json("id") === SEED.cabinetId, "location details work");
  });

  sleep(1);
}

export function adminPaths(data) {
  const token = data.adminToken;

  group("admin user management reads", () => {
    const users = http.get(`${API_BASE_URL}/users?limit=50&page=1`, {
      headers: jsonHeaders(token),
      tags: { flow: "admin", endpoint: "users.list" },
    });
    searchLatency.add(users.timings.duration);
    recordCheck(users, (res) => res.status === 200 && Array.isArray(res.json("users")), "users list works");

    const searchedUsers = http.get(`${API_BASE_URL}/users?search=seed&limit=20&page=1`, {
      headers: jsonHeaders(token),
      tags: { flow: "admin", endpoint: "users.search" },
    });
    searchLatency.add(searchedUsers.timings.duration);
    recordCheck(searchedUsers, (res) => res.status === 200, "users search works");

    const me = http.get(`${API_BASE_URL}/auth/me`, {
      headers: jsonHeaders(token),
      tags: { flow: "admin", endpoint: "auth.me" },
    });
    recordCheck(me, (res) => res.status === 200 && res.json("role") === "admin", "current admin works");
  });

  sleep(1);
}

export function crudPaths(data) {
  const token = data.adminToken;
  const suffix = `${__VU}-${__ITER}-${Date.now()}`;
  let itemId = null;
  let categoryId = null;

  group("inventory and category CRUD", () => {
    const createCategory = http.post(
      `${API_BASE_URL}/categories`,
      JSON.stringify({ name: `Load category ${suffix}`, parent_id: SEED.electronicsCategoryId }),
      requestOptions(token, "crud", "categories.create"),
    );
    crudLatency.add(createCategory.timings.duration);
    recordCheck(createCategory, (res) => res.status === 201 && Number.isInteger(res.json("id")), "category create works");
    categoryId = createCategory.json("id");

    const createItem = http.post(
      `${API_BASE_URL}/items`,
      JSON.stringify({
        name: `Load test item ${suffix}`,
        category_id: categoryId || SEED.accessoriesCategoryId,
        location_id: SEED.cabinetId,
        owner_id: SEED.regularUserId,
        description: "Created by k6 E2E load tests",
        parameters: { load_test: true, suffix },
        oldID: `LT-${suffix}`,
      }),
      requestOptions(token, "crud", "items.create"),
    );
    crudLatency.add(createItem.timings.duration);
    const itemCreated = recordCheck(createItem, (res) => res.status === 201 && Boolean(res.json("id")), "item create works");
    if (!itemCreated) {
      return;
    }
    crudItems.add(1);
    itemId = createItem.json("id");

    const updateItem = http.patch(
      `${API_BASE_URL}/items/${itemId}`,
      JSON.stringify({
        name: `Updated load item ${suffix}`,
        description: "Updated by k6 E2E load tests",
        location_id: SEED.roomId,
        parameters: { load_test: true, updated: true, suffix },
      }),
      requestOptions(token, "crud", "items.update"),
    );
    crudLatency.add(updateItem.timings.duration);
    recordCheck(updateItem, (res) => res.status === 200 && res.json("id") === itemId, "item update works");

    const readUpdatedItem = http.get(`${API_BASE_URL}/items/${itemId}`, {
      headers: jsonHeaders(token),
      tags: { flow: "crud", endpoint: "items.details.created" },
    });
    crudLatency.add(readUpdatedItem.timings.duration);
    recordCheck(
      readUpdatedItem,
      (res) => {
        const body = json(res);
        return res.status === 200 && body.location && body.location.id === SEED.roomId;
      },
      "created item details work",
    );

    const deleteItem = http.del(`${API_BASE_URL}/items/${itemId}`, null, {
      headers: jsonHeaders(token),
      tags: { flow: "crud", endpoint: "items.delete" },
    });
    crudLatency.add(deleteItem.timings.duration);
    recordCheck(deleteItem, (res) => res.status === 204, "item delete works");

    if (categoryId) {
      const deleteCategory = http.del(
        `${API_BASE_URL}/categories/${categoryId}?replacement_category_id=${SEED.accessoriesCategoryId}`,
        null,
        requestOptions(token, "crud", "categories.delete"),
      );
      crudLatency.add(deleteCategory.timings.duration);
      recordCheck(deleteCategory, (res) => res.status === 200, "category delete works");
    }
  });

  sleep(1);
}
