// index.test.js

import Graffy from '@graffy/core';
import { page, link, graph, query } from '@graffy/common';
import { mockBackend } from '@graffy/testing';
import live from './index.js';

let g, backend;

beforeEach(() => {
  g = new Graffy();
  g.use(live());
  backend = mockBackend();
  g.use(backend.middleware);

  backend.put(
    graph({
      bar: {
        1: { x: 1 },
        2: { x: 2 },
        3: { x: 3 },
        4: { x: 4 },
        5: { x: 5 },
      },
      foo: page({
        a: link(['bar', '1']),
        b: link(['bar', '2']),
        c: link(['bar', '3']),
        d: link(['bar', '4']),
        e: link(['bar', '5']),
      }),
    }),
  );
});

// 1. broken link (linked data is unknown)
// 2. broken link (linked data is null)
// 3. broken link (linked data was there, got removed)
// 4. no broken link (linked data and link removed together)

test('indexes', async () => {
  const sub = g.sub(
    query({
      foo: [{ first: 3 }, { x: true }],
    }),
  );

  expect((await sub.next()).value).toEqual(
    graph({
      bar: {
        1: { x: 1 },
        2: { x: 2 },
        3: { x: 3 },
      },
      foo: page(
        {
          a: link(['bar', '1']),
          b: link(['bar', '2']),
          c: link(['bar', '3']),
        },
        '',
        'c',
      ),
    }),
  );

  backend.put(
    graph(
      {
        bar: {
          2: null,
        },
        foo: {
          b: null,
        },
      },
      1,
    ),
  );

  expect((await sub.next()).value).toEqual(
    graph({
      bar: {
        1: { x: 1 },
        3: { x: 3 },
        4: { x: 4 },
      },
      foo: [
        { key: '', end: '`\uffff', clock: 0 },
        { key: 'a', path: ['bar', '1'], clock: 0 },
        { key: 'a\0', end: 'a\uffff', clock: 0 },
        { key: 'b', end: 'b', clock: 1 },
        { key: 'b\0', end: 'b\uffff', clock: 0 },
        { key: 'c', path: ['bar', '3'], clock: 0 },
        { key: 'c\0', end: 'c\uffff', clock: 0 },
        { key: 'd', path: ['bar', '4'], clock: 0 },
      ],
    }),
  );
});
