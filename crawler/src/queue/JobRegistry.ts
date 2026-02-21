import { Job } from "./Job";

/**
 * Global registry that maps job class names → job class constructors.
 *
 * Laravel equivalent: the job class resolution via the IoC container.
 *
 * When you register `CrawlPageJob`, the worker knows how to resolve
 * the class name "CrawlPageJob" that comes off the queue back into
 * an actual class instance so it can call `handle()`.
 */

type JobConstructor = new () => Job<any>;

const registry = new Map<string, JobConstructor>();

/**
 * Register one or more job classes so the worker can resolve them.
 *
 * ```ts
 * registerJobs(CrawlPageJob, ProcessDocumentJob);
 * ```
 */
export function registerJobs(...jobs: JobConstructor[]): void {
    for (const JobClass of jobs) {
        registry.set(JobClass.name, JobClass);
        console.log(`[JobRegistry] Registered job: ${JobClass.name}`);
    }
}

/**
 * Resolve a job constructor by its class name.
 * Returns `undefined` if the job was never registered.
 */
export function resolveJob(name: string): JobConstructor | undefined {
    return registry.get(name);
}

/** List all registered job names */
export function getRegisteredJobNames(): string[] {
    return Array.from(registry.keys());
}
