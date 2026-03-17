import { Job } from "../Job";

// ── Helpers ───────────────────────────────────────────────────────────────────

// Dummy job subclasses for registration
class AlphaJob extends Job<{ id: number }> {
    async handle(): Promise<void> {}
}

class BetaJob extends Job<{ name: string }> {
    async handle(): Promise<void> {}
}

class GammaJob extends Job<Record<string, unknown>> {
    async handle(): Promise<void> {}
}

// ── Tests ─────────────────────────────────────────────────────────────────────

// JobRegistry uses a module-level Map that persists across imports in the same
// test run. We use jest.isolateModules() per test to get a fresh registry.

describe("JobRegistry", () => {
    describe("registerJobs()", () => {
        it("registers a single job", () => {
            jest.isolateModules(() => {
                const { registerJobs, resolveJob } = require("../JobRegistry");
                registerJobs(AlphaJob);
                expect(resolveJob("AlphaJob")).toBe(AlphaJob);
            });
        });

        it("registers multiple jobs in one call", () => {
            jest.isolateModules(() => {
                const { registerJobs, resolveJob } = require("../JobRegistry");
                registerJobs(AlphaJob, BetaJob, GammaJob);
                expect(resolveJob("AlphaJob")).toBe(AlphaJob);
                expect(resolveJob("BetaJob")).toBe(BetaJob);
                expect(resolveJob("GammaJob")).toBe(GammaJob);
            });
        });

        it("overwrites a duplicate registration with the new constructor", () => {
            jest.isolateModules(() => {
                const { registerJobs, resolveJob } = require("../JobRegistry");

                // Two distinct classes that happen to share the same runtime name
                // (both are named "AlphaJob" in their respective scopes)
                class AlphaJob extends Job<{ id: number }> {
                    async handle(): Promise<void> {}
                    tag = "original";
                }

                // Build a second constructor with the same .name without using
                // `static override name` (which conflicts with Function.name in TS).
                const AlphaJobV2 = class AlphaJob extends Job<{ id: number }> {
                    async handle(): Promise<void> {}
                    tag = "v2";
                };

                registerJobs(AlphaJob);
                registerJobs(AlphaJobV2);

                // Both share the name "AlphaJob"; second registration should win
                expect(resolveJob("AlphaJob")).toBe(AlphaJobV2);
            });
        });
    });

    describe("resolveJob()", () => {
        it("returns the constructor for a registered job name", () => {
            jest.isolateModules(() => {
                const { registerJobs, resolveJob } = require("../JobRegistry");
                registerJobs(BetaJob);
                expect(resolveJob("BetaJob")).toBe(BetaJob);
            });
        });

        it("returns undefined for an unknown job name", () => {
            jest.isolateModules(() => {
                const { resolveJob } = require("../JobRegistry");
                expect(resolveJob("NonExistentJob")).toBeUndefined();
            });
        });
    });

    describe("getRegisteredJobNames()", () => {
        it("returns an empty array when no jobs are registered", () => {
            jest.isolateModules(() => {
                const { getRegisteredJobNames } = require("../JobRegistry");
                expect(getRegisteredJobNames()).toEqual([]);
            });
        });

        it("returns all registered job names", () => {
            jest.isolateModules(() => {
                const { registerJobs, getRegisteredJobNames } =
                    require("../JobRegistry");
                registerJobs(AlphaJob, BetaJob, GammaJob);
                const names = getRegisteredJobNames();
                expect(names).toContain("AlphaJob");
                expect(names).toContain("BetaJob");
                expect(names).toContain("GammaJob");
                expect(names).toHaveLength(3);
            });
        });
    });
});
