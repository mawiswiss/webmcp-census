import { test } from "node:test";
import assert from "node:assert/strict";
import { isGraphqlRead } from "../src/lib/ignore.mjs";

const post = (body) => ({ method: "POST", url: "https://shop.example/api/graphql.json", body: typeof body === "string" ? body : JSON.stringify(body) });

test("GraphQL query documents count as reads", () => {
  assert.equal(isGraphqlRead(post({ query: "query Shop { shop { name } }", variables: {} })), true);
  assert.equal(isGraphqlRead(post({ query: "{ shop { name } }" })), true);
  assert.equal(isGraphqlRead(post({ query: "# cached\nquery { products(first: 3) { nodes { id } } }" })), true);
  assert.equal(isGraphqlRead(post({ query: "fragment F on Shop { name } query Q { shop { ...F } }" })), true);
  assert.equal(isGraphqlRead(post([{ query: "query A { a }" }, { query: "{ b }" }])), true);
});

test("mutations, subscriptions and anything unrecognised stay writes", () => {
  assert.equal(isGraphqlRead(post({ query: "mutation { cartCreate { cart { id } } }" })), false);
  assert.equal(isGraphqlRead(post({ query: "fragment F on Cart { id } mutation M { cartCreate { cart { ...F } } }" })), false);
  assert.equal(isGraphqlRead(post({ query: "subscription { orders { id } }" })), false);
  assert.equal(isGraphqlRead(post([{ query: "query A { a }" }, { query: "mutation B { b }" }])), false);
  assert.equal(isGraphqlRead(post({ extensions: { persistedQuery: { version: 1, sha256Hash: "abc" } } })), false);
  assert.equal(isGraphqlRead(post("{}")), false);
  assert.equal(isGraphqlRead(post("query=%7B%20a%20%7D")), false);
  assert.equal(isGraphqlRead(post([])), false);
  assert.equal(isGraphqlRead({ method: "POST", url: "https://shop.example/track" }), false);
});
