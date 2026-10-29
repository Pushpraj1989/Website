// Outline rules for delivery areas. The server checks the same rules; these tests keep the admin's feedback honest.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addCorner, undoCorner, ring, crossesItself, outlineProblem, boundsOf, centreOf, validPoint } from '../src/zoneGeometry.js';

const SQUARE = [[55.0, 26.0], [55.1, 26.0], [55.1, 26.1], [55.0, 26.1]];

test('corners are added in order, and a repeated click on the same spot adds nothing', () => {
  let points = [];
  points = addCorner(points, [55, 26]);
  points = addCorner(points, [55.1, 26]);
  points = addCorner(points, [55.1, 26]);
  assert.equal(points.length, 2);
});

test('a corner outside the world is refused', () => {
  assert.equal(addCorner([], [200, 0]).length, 0);
  assert.equal(validPoint([55, 91]), false);
});

test('undo removes the last corner and leaves the others', () => {
  assert.deepEqual(undoCorner(SQUARE), SQUARE.slice(0, 3));
});

test('the ring closes back to its first corner', () => {
  const closed = ring(SQUARE);
  assert.deepEqual(closed[closed.length - 1], SQUARE[0]);
  assert.equal(closed.length, SQUARE.length + 1);
});

test('a square is a valid outline', () => {
  assert.equal(outlineProblem(SQUARE), null);
});

test('fewer than three corners cannot be saved', () => {
  assert.match(outlineProblem(SQUARE.slice(0, 2)), /at least 3/);
});

test('an outline that crosses itself is caught before saving', () => {
  const bowtie = [[55.0, 26.0], [55.1, 26.1], [55.1, 26.0], [55.0, 26.1]];
  assert.equal(crossesItself(bowtie), true);
  assert.match(outlineProblem(bowtie), /crosses itself/);
});

test('a convex shape with a corner that shares an edge is not reported as crossing', () => {
  const triangle = [[55, 26], [55.2, 26], [55.1, 26.2]];
  assert.equal(crossesItself(triangle), false);
  const pentagon = [[55, 26], [55.2, 26], [55.25, 26.1], [55.1, 26.2], [54.95, 26.1]];
  assert.equal(crossesItself(pentagon), false);
});

test('the map box covers every area, and its centre is the middle of the box', () => {
  const bounds = boundsOf([SQUARE, [[55.5, 25.0], [55.6, 25.1], [55.5, 25.2]]]);
  assert.deepEqual(bounds, [[55.0, 25.0], [55.6, 26.1]]);
  const [lng, lat] = centreOf(bounds);
  assert.ok(Math.abs(lng - 55.3) < 1e-9);
  assert.ok(Math.abs(lat - 25.55) < 1e-9);
  assert.equal(boundsOf([]), null);
});
