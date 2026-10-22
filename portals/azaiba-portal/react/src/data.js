// Content comes from the JSON the CMS edits (exported to /data/ by build.py).
// Relative URLs resolve from /app/, so the React build works under any sub-path.
import { useEffect, useState } from "react";

const cache = {};

function load(name) {
  if (!cache[name]) {
    cache[name] = fetch(new URL(`../data/${name}.json`, window.location.href), { credentials: "omit" })
      .then((res) => {
        if (!res.ok) throw new Error(`Could not load ${name} (${res.status})`);
        return res.json();
      });
  }
  return cache[name];
}

export function useContent() {
  const [state, setState] = useState({ site: null, buildings: null, listings: null, error: null });
  useEffect(() => {
    let active = true;
    Promise.all([load("site"), load("buildings"), load("listings")])
      .then(([site, buildings, listings]) => active && setState({ site, buildings, listings, error: null }))
      .catch((error) => active && setState((s) => ({ ...s, error })));
    return () => {
      active = false;
    };
  }, []);
  return state;
}

export function mediaUrl(file) {
  return new URL(`../media/${file}`, window.location.href).href;
}
