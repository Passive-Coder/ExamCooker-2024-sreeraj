import React from "react";
import type { CSSProperties } from "react";
import type { SearchableCourseRecord } from "@/lib/data/courseCatalog";

const ROW_COUNT = 5;
const TILES_PER_ROW = 9;
const EDGE_FADE = "linear-gradient(to right, transparent 0%, black 7%, black 93%, transparent 100%)";
const TITLE_CLAMP_STYLE: CSSProperties = {
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 2,
    overflow: "hidden",
    maxWidth: "100%",
    overflowWrap: "anywhere",
    wordBreak: "break-word",
};

const TILE_WIDTHS = [
    "w-[10.5rem] sm:w-[12rem] lg:w-[13.5rem]",
    "w-[11.75rem] sm:w-[13.25rem] lg:w-[14.75rem]",
    "w-[13rem] sm:w-[14.5rem] lg:w-[16rem]",
    "w-[12.25rem] sm:w-[13.75rem] lg:w-[15.25rem]",
];

function hashString(value: string) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function getDisplayCourses(courses: SearchableCourseRecord[]) {
    const candidates = courses.filter((course) => course.paperCount > 0);
    const source = candidates.length > 0 ? candidates : courses;

    return [...source]
        .sort((left, right) => {
            const leftHash = hashString(`${left.code}:${left.title}`);
            const rightHash = hashString(`${right.code}:${right.title}`);
            return leftHash - rightHash || left.code.localeCompare(right.code);
        })
        .slice(0, Math.max(18, Math.min(source.length, 30)));
}

function buildRows(courses: SearchableCourseRecord[]) {
    const pool = getDisplayCourses(courses);
    if (pool.length === 0) {
        return [];
    }

    return Array.from({ length: ROW_COUNT }, (_, rowIndex) =>
        Array.from({ length: TILES_PER_ROW }, (_, itemIndex) => {
            const courseIndex = (rowIndex * 4 + itemIndex * 5) % pool.length;
            return pool[courseIndex];
        }),
    );
}

export default function CourseBackdrop({
    courses,
}: {
    courses: SearchableCourseRecord[];
}) {
    const rows = buildRows(courses);

    if (rows.length === 0) {
        return null;
    }

    return (
        <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 bottom-32 overflow-hidden sm:bottom-36 lg:bottom-44"
        >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(95,196,231,0.1),transparent_34%),radial-gradient(circle_at_bottom,rgba(37,62,224,0.08),transparent_40%)] dark:bg-[radial-gradient(circle_at_top,rgba(95,196,231,0.05),transparent_30%),radial-gradient(circle_at_bottom,rgba(37,62,224,0.12),transparent_42%)]" />

            <div className="grid h-full grid-rows-4 gap-2 px-4 py-5 sm:grid-rows-5 sm:gap-3 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
                {rows.map((row, rowIndex) => (
                    <div
                        key={`row-${rowIndex}`}
                        className={`min-h-0 overflow-hidden ${rowIndex === rows.length - 1 ? "hidden sm:block" : ""}`}
                        style={{ maskImage: EDGE_FADE, WebkitMaskImage: EDGE_FADE }}
                    >
                        <div
                            className={`flex h-full w-max items-stretch ${
                                rowIndex % 2 === 0 ? "animate-marquee" : "animate-marquee-reverse"
                            }`}
                            style={{ animationDuration: `${92 + rowIndex * 8}s` }}
                        >
                            {(["base", "clone"] as const).map((copy) => (
                                <div
                                    key={`${copy}-${rowIndex}`}
                                    className="flex h-full shrink-0 items-stretch gap-2 pr-2 sm:gap-3 sm:pr-3 lg:gap-4 lg:pr-4"
                                >
                                    {row.map((course, tileIndex) => {
                                        const widthClass =
                                            TILE_WIDTHS[(rowIndex + tileIndex) % TILE_WIDTHS.length];

                                        return (
                                            <article
                                                key={`${copy}-${rowIndex}-${course.id}-${tileIndex}`}
                                                className={`${widthClass} grid h-full min-w-0 shrink-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden border border-black/[0.05] bg-white/[0.04] px-3 py-3 text-black/32 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] sm:px-3.5 sm:py-3.5 dark:border-white/[0.05] dark:bg-[#0D1528]/[0.1] dark:text-white/[0.24]`}
                                            >
                                                <p className="text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-black/26 sm:text-[0.62rem] dark:text-white/[0.18]">
                                                    {course.code}
                                                </p>

                                                <h3
                                                    className="mt-2 min-w-0 max-w-full overflow-hidden text-[0.72rem] font-semibold leading-[1.12] text-black/34 sm:text-[0.8rem] lg:text-[0.88rem] dark:text-white/[0.27]"
                                                    style={TITLE_CLAMP_STYLE}
                                                >
                                                    {course.title}
                                                </h3>
                                            </article>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <div className="absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-[#C2E6EC] via-[#C2E6EC]/88 to-transparent sm:w-20 lg:w-24 dark:from-[hsl(224,48%,9%)] dark:via-[hsl(224,48%,9%)]/88" />
            <div className="absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#C2E6EC] via-[#C2E6EC]/88 to-transparent sm:w-20 lg:w-24 dark:from-[hsl(224,48%,9%)] dark:via-[hsl(224,48%,9%)]/88" />
            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#C2E6EC] via-[#C2E6EC]/78 to-transparent sm:h-28 dark:from-[hsl(224,48%,9%)] dark:via-[hsl(224,48%,9%)]/78" />
            <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#C2E6EC] via-[#C2E6EC]/88 to-transparent sm:h-36 dark:from-[hsl(224,48%,9%)] dark:via-[hsl(224,48%,9%)]/88" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(194,230,236,0.36)_0%,rgba(194,230,236,0.18)_34%,transparent_62%)] dark:bg-[radial-gradient(circle_at_center,rgba(12,18,34,0.5)_0%,rgba(12,18,34,0.28)_36%,transparent_62%)]" />
        </div>
    );
}
