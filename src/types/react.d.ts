declare module 'react' {
  const React: {
    createElement: (...args: any[]) => any;
  };

  export function useEffect(effect: () => void, deps?: unknown[]): void;
  export function useState<T>(initial: T): [T, (value: T | ((current: T) => T)) => void];
  export default React;
}
