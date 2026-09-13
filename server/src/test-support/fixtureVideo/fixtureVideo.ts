import { fileURLToPath } from 'node:url';

/**
 * The one file in the repository with a real duration in it: ten seconds of
 * colour bars, H.264 in an MP4, silent and about 23 KB.
 *
 * It arrived with the dev seed, which copied it behind every fixture movie so
 * the player had bytes a browser could decode; the seed went with bulk import
 * (#127), and this stayed because two things still need a file that genuinely
 * is a film. The stream suite writes hand-made buffers, since bytes going out
 * over a Range are all it asks about — but the playback read asks how long a
 * film is, and `mediaDuration` reads that from the container's own header, so
 * both need a container with a real one.
 *
 * Deliberately the container and codec that **direct-play**: the stream route
 * sends the file as it is, so a test over it exercises the path that needs no
 * Playback component, which is the one every machine has.
 */
export const FIXTURE_VIDEO = fileURLToPath(
  new URL('./fixture-video.mp4', import.meta.url)
);

/** What the fixture is: ten seconds, exactly, by its own container header. */
export const FIXTURE_DURATION_SECONDS = 10;
