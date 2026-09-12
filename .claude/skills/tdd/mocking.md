# When to Mock

Mock at **system boundaries** only. Your own modules and internal
collaborators are tested through their public interface, never replaced.

## This project's boundaries, and the double for each

| Boundary                       | Double                                                                        |
| ------------------------------ | ----------------------------------------------------------------------------- |
| SQLite                         | `freshStorage` — the harness every `library/` test opens its database through |
| The managed media directory    | `sandboxRoot` — a real temp dir, removed when the test ends                   |
| Finding the Playback component | `componentDir` — a temp dir of empty fake binaries, for the resolution suites |
| Running it                     | a `PlaybackComponent` handed to `createPlayback` — the seam is injected       |
| `fetch` in the frontend        | `fakeResponse` — `okResponse`, `serverErrorResponse`, the 404                 |
| The `<video>` element (jsdom)  | `stubMediaElement`, `stubFullscreen`                                          |
| Time / randomness              | `vi.useFakeTimers`, `vi.spyOn(Math, 'random')`                                |

Both `test-support/` folders hold more (movie factories, a location probe);
list them before writing a new one.

## Designing for Mockability

At system boundaries, design interfaces that are easy to mock:

**1. Use dependency injection**

Pass external dependencies in rather than creating them internally:

```typescript
// Easy to mock
function createPlayback(ffmpeg: FfmpegComponent, mediaRoot: string) {}

// Hard to mock
function createPlayback() {
  const ffmpeg = resolveFfmpegBinary(process.env.FAMILYFLIX_FFMPEG_PATH);
}
```

**2. Prefer SDK-style interfaces over generic fetchers**

Create specific functions for each external operation instead of
one generic function with conditional logic:

```typescript
// GOOD: Each function is independently mockable
const api = {
  fetchMovie: (id) => fetch(`/api/movies/${id}`),
  saveFavorite: (id, favorite) =>
    postValue(`/api/movies/${id}/favorite`, favorite),
  saveResume: (id, seconds) => postValue(`/api/movies/${id}/resume`, seconds),
};

// BAD: Mocking requires conditional logic inside the mock
const api = {
  fetch: (endpoint, options) => fetch(endpoint, options),
};
```

The SDK approach means:

- Each mock returns one specific shape
- No conditional logic in test setup
- Easier to see which endpoints a test exercises
- Type safety per endpoint
