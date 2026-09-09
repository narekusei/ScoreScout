import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { JSDOM } from "jsdom";
import React from "react";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import Home from "../app/page";
import { opportunities as demoOpportunities } from "../lib/opportunity";
import { serializeSavedOpportunities } from "../lib/saved-opportunities";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://scorescout.test/",
});

Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  Event: dom.window.Event,
  MouseEvent: dom.window.MouseEvent,
  IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: dom.window.navigator,
});

const originalFetch = globalThis.fetch;

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});

test("shows the loading state and renders successful live search results", async () => {
  let resolveFetch!: (response: Response) => void;
  globalThis.fetch = (input) => {
    if (String(input).startsWith("/api/saved-opportunities")) {
      return Promise.resolve(new Response(null, { status: 401 }));
    }
    return new Promise<Response>((resolve) => { resolveFetch = resolve; });
  };

  const view = render(<Home />);
  await act(async () => {});
  const searchButton = view.getByRole("button", { name: "Scout opportunities" });
  fireEvent.click(searchButton);

  assert.equal(view.getByRole("button", { name: "Scouting…" }).hasAttribute("disabled"), true);
  assert.match(view.getByRole("status").textContent ?? "", /Scouting connected sources/);
  assert.equal(view.container.querySelectorAll(".skeletonCard").length, 3);

  await act(async () => {
    resolveFetch(new Response(
      JSON.stringify({
        opportunities: [
          {
            id: "live-composer",
            title: "Composer wanted for an adventure game",
            description: "Paid remote score commission.",
            source: "RSS",
            community: "Studio feed",
            url: "https://example.com/job",
            publishedAt: "2026-09-05T00:00:00.000Z",
            ageHours: 3,
            budgetLabel: "$2,000 fixed",
            tags: ["Game music", "Paid", "Remote"],
            score: 95,
            scoreReasons: ["music role in title"],
          },
        ],
        meta: {
          collected: 4,
          returned: 1,
          sources: ["RSS", "Lever"],
          failedRequests: [{ source: "Lever", target: "studio", message: "Timed out" }],
        },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    ));
  });

  await waitFor(() => view.getByText("Composer wanted for an adventure game"));
  assert.match(view.getByRole("status").textContent ?? "", /1 strong matches from 4 posts checked/);
  assert.ok(view.getByText("2", { selector: ".trustLine b" }));
  assert.match(view.getByRole("alert").textContent ?? "", /Lever/);
  const externalLink = view.getByRole("link", { name: "View post ↗" });
  assert.equal(externalLink.getAttribute("target"), "_blank");
  assert.equal(externalLink.getAttribute("rel"), "noopener noreferrer");
});

test("labels demonstration freshness truthfully", async () => {
  const view = render(<Home />);
  await act(async () => {});

  assert.equal(view.getAllByText("Sample data").length, 3);
  assert.equal(view.queryByText(/ago$/), null);
});

test("filters opportunities and restores the complete result set", async () => {
  const view = render(<Home />);
  await act(async () => {});

  assert.equal(view.getAllByRole("article").length, 3);
  fireEvent.click(view.getByRole("checkbox", { name: "Budget specified" }));
  assert.equal(view.getAllByRole("article").length, 2);
  assert.equal(view.queryByText(/mobile puzzle game/i), null);

  fireEvent.click(view.getByRole("checkbox", { name: "Composition" }));
  fireEvent.click(view.getByRole("checkbox", { name: "Game audio" }));
  fireEvent.click(view.getByRole("checkbox", { name: "Film scoring" }));
  assert.ok(view.getByText("No opportunities match these filters"));

  fireEvent.click(view.getAllByRole("button", { name: "Reset filters" })[0]);
  assert.equal(view.getAllByRole("article").length, 3);
});

test("saves an opportunity, persists its application status, and restores both", async () => {
  const title = "Composer needed for a narrative indie game";
  const view = render(<Home />);
  await act(async () => {});

  fireEvent.click(view.getByRole("button", { name: `Save ${title}` }));
  const statusSelect = view.getByRole("combobox", { name: `Application status for ${title}` });
  fireEvent.change(statusSelect, { target: { value: "Interview" } });

  assert.match(window.localStorage.getItem("scorescout:saved-opportunities") ?? "", /reddit-indie-game-composer/);
  assert.match(window.localStorage.getItem("scorescout:application-statuses") ?? "", /Interview/);

  cleanup();
  const restored = render(<Home />);

  await waitFor(() => {
    assert.equal(restored.getByText("1", { selector: ".savedButton span" }).textContent, "1");
  });
  assert.equal(
    (restored.getByRole("combobox", { name: `Application status for ${title}` }) as HTMLSelectElement)
      .value,
    "Interview",
  );

  fireEvent.click(restored.getByRole("button", { name: "Saved 1" }));
  assert.equal(restored.getAllByRole("article").length, 1);
  assert.ok(restored.getByText(title));
});

test("migrates local saved data once and switches to cloud storage", async () => {
  const saved = demoOpportunities[0];
  window.localStorage.setItem(
    "scorescout:saved-opportunities",
    serializeSavedOpportunities([saved]),
  );
  window.localStorage.setItem(
    "scorescout:application-statuses",
    JSON.stringify({ [saved.id]: "Interview" }),
  );
  const methods: string[] = [];
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "/api/saved-opportunities");
    methods.push(init?.method ?? "GET");
    return new Response(JSON.stringify({
      userId: "user-1",
      opportunities: init?.method === "PUT" ? [saved] : [],
      statuses: init?.method === "PUT" ? { [saved.id]: "Interview" } : {},
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  const view = render(<Home />);
  await waitFor(() => assert.ok(view.getByText("Cloud", { selector: ".trustLine b" })));
  assert.deepEqual(methods, ["GET", "PUT"]);
  assert.equal(window.localStorage.getItem("scorescout:saved-opportunities"), null);
  assert.equal(window.localStorage.getItem("scorescout:application-statuses"), null);
  assert.equal(window.localStorage.getItem("scorescout:server-migration:user-1"), "complete");
  assert.equal(
    (view.getByRole("combobox", { name: `Application status for ${saved.title}` }) as HTMLSelectElement).value,
    "Interview",
  );
});

test("shows the API error state without replacing the current opportunities", async () => {
  globalThis.fetch = async (input) =>
    String(input).startsWith("/api/saved-opportunities")
      ? new Response(null, { status: 401 })
      : new Response(JSON.stringify({ message: "Collector unavailable" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });

  const view = render(<Home />);
  await act(async () => {});
  fireEvent.submit(view.getByRole("button", { name: "Scout opportunities" }).closest("form")!);

  await waitFor(() => assert.equal(view.getByRole("status").textContent, "Collector unavailable"));
  assert.equal(view.getAllByRole("article").length, 3);
});

test("shows a useful retry message when Reddit rate limits the search", async () => {
  globalThis.fetch = async (input) =>
    String(input).startsWith("/api/saved-opportunities")
      ? new Response(null, { status: 401 })
      : new Response(JSON.stringify({
      message: "Reddit search request failed",
      retryAfterSeconds: 23,
    }), {
      status: 429,
      headers: { "content-type": "application/json", "retry-after": "23" },
    });

  const view = render(<Home />);
  await act(async () => {});
  fireEvent.submit(view.getByRole("button", { name: "Scout opportunities" }).closest("form")!);

  await waitFor(() => assert.equal(
    view.getByRole("status").textContent,
    "Reddit rate limit reached. Try again in 23 seconds.",
  ));
});
