import { useLocation } from "react-router-dom";

/** Shows where the router is, for tests that check where a page navigated to. */
export function CurrentLocation() {
  const { pathname, search } = useLocation();
  return <div data-testid="current-location">{`${pathname}${search}`}</div>;
}
