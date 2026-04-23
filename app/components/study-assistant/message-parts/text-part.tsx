"use client";

import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import { streamdownPlugins } from "@/lib/streamdown-config";

interface TextPartProps {
    id: string;
    text: string;
    isResponseTail?: boolean;
    isStreaming?: boolean;
}

type PencilState = {
    left: number;
    top: number;
    travel: number;
    durationMs: number;
    mode: "streaming" | "idle" | "settled";
};

const STREAMING_PENCIL_WIDTH_PX = 28;
const STREAMING_PENCIL_SIDE_INSET_PX = 8;
const STREAMING_ACTIVITY_WINDOW_MS = 420;
const STREAMING_PENCIL_SCAN_SPEED_PX_PER_S = 320;
const STREAMING_PENCIL_MIN_DURATION_MS = 1800;
const STREAMING_PENCIL_MAX_DURATION_MS = 4200;
const STREAMING_PENCIL_LAST_LINE_GAP_PX = 12;
const STREAMING_PENCIL_END_GAP_PX = 10;

export const TextPart = memo(function TextPart({
    id,
    text,
    isResponseTail,
    isStreaming,
}: TextPartProps) {
    const contentRef = useRef<HTMLDivElement | null>(null);
    const animatedTextOnceRef = useRef(false);
    const lastStreamingTextAtRef = useRef(0);
    const [hasStreamedOnce, setHasStreamedOnce] = useState(false);
    const [pencilState, setPencilState] = useState<PencilState | null>(null);
    const [isEntering, setIsEntering] = useState(false);

    const showPencil = Boolean(isResponseTail && (isStreaming || hasStreamedOnce));

    useEffect(() => {
        if (isStreaming) {
            setHasStreamedOnce(true);
        }
    }, [isStreaming]);

    useEffect(() => {
        if (isStreaming && hasVisibleText(text)) {
            lastStreamingTextAtRef.current = performance.now();
        }
    }, [isStreaming, text]);

    useEffect(() => {
        if (!isStreaming) {
            animatedTextOnceRef.current = false;
            setIsEntering(false);
            return;
        }

        if (!hasVisibleText(text) || animatedTextOnceRef.current) {
            return;
        }

        animatedTextOnceRef.current = true;
        setIsEntering(true);

        const timeout = window.setTimeout(() => {
            setIsEntering(false);
        }, 220);

        return () => {
            window.clearTimeout(timeout);
        };
    }, [isStreaming, text]);

    useLayoutEffect(() => {
        if (!showPencil) {
            setPencilState(null);
            return;
        }

        const root = contentRef.current;
        if (!root) return;

        let resizeFrame = 0;
        let idleTimeout = 0;
        let observer: ResizeObserver | null = null;

        const updatePosition = () => {
            const isActivelyStreaming =
                Boolean(isStreaming) &&
                hasVisibleText(text) &&
                performance.now() - lastStreamingTextAtRef.current <=
                    STREAMING_ACTIVITY_WINDOW_MS;
            const next = getPencilState(root, {
                isStreaming: Boolean(isStreaming),
                isActivelyStreaming,
            });

            setPencilState((prev) => {
                if (
                    prev &&
                    next &&
                    prev.left === next.left &&
                    prev.top === next.top &&
                    prev.travel === next.travel &&
                    prev.durationMs === next.durationMs &&
                    prev.mode === next.mode
                ) {
                    return prev;
                }
                return next;
            });
        };

        const scheduleIdleSync = () => {
            window.clearTimeout(idleTimeout);
            if (!isStreaming || !hasVisibleText(text)) {
                return;
            }

            const elapsedMs = performance.now() - lastStreamingTextAtRef.current;
            const waitMs = Math.max(0, STREAMING_ACTIVITY_WINDOW_MS - elapsedMs);
            idleTimeout = window.setTimeout(updatePosition, waitMs + 24);
        };

        updatePosition();
        scheduleIdleSync();

        if (typeof ResizeObserver !== "undefined") {
            observer = new ResizeObserver(() => {
                window.cancelAnimationFrame(resizeFrame);
                resizeFrame = window.requestAnimationFrame(() => {
                    updatePosition();
                    scheduleIdleSync();
                });
            });
            observer.observe(root);
        }

        return () => {
            window.cancelAnimationFrame(resizeFrame);
            window.clearTimeout(idleTimeout);
            observer?.disconnect();
        };
    }, [isResponseTail, isStreaming, showPencil, text]);

    return (
        <div className="relative">
            <div
                ref={contentRef}
                className={[
                    "prose prose-neutral dark:prose-invert max-w-none font-sans text-[15px] leading-relaxed text-black dark:text-[#D5D5D5]",
                    isEntering ? "study-streaming-text-enter" : "",
                ].join(" ")}
            >
                <div
                    className="study-streaming-content"
                    data-streaming={
                        isStreaming && hasVisibleText(text) ? "true" : undefined
                    }
                >
                    <Streamdown
                        key={id}
                        mode={isStreaming ? "streaming" : "static"}
                        isAnimating={!!isStreaming}
                        plugins={streamdownPlugins}
                    >
                        {text}
                    </Streamdown>
                </div>
            </div>

            {showPencil && pencilState && (
                <span
                    aria-hidden="true"
                    className="study-streaming-pencil-anchor"
                    data-state={pencilState.mode}
                    style={{
                        left: `${pencilState.left}px`,
                        top: `${pencilState.top}px`,
                        ["--study-pencil-travel-x" as string]: `${pencilState.travel}px`,
                        ["--study-pencil-scan-duration" as string]: `${pencilState.durationMs}ms`,
                    }}
                >
                    <span className="study-streaming-pencil-track">
                        <span className="study-streaming-pencil" />
                    </span>
                </span>
            )}
        </div>
    );
});

function hasVisibleText(text: string) {
    return text.trim().length > 0;
}

function getPencilState(
    root: HTMLElement,
    {
        isStreaming,
        isActivelyStreaming,
    }: {
        isStreaming: boolean;
        isActivelyStreaming: boolean;
    }
): PencilState {
    if (isStreaming) {
        if (isActivelyStreaming) {
            return getStreamingPencilState(root);
        }
        return getIdlePencilState(root);
    }

    return getSettledPencilState(root);
}

function getStreamingPencilState(root: HTMLElement): PencilState {
    const rootRect = root.getBoundingClientRect();
    const tail = findLastTextTail(root);
    const minLeft = STREAMING_PENCIL_SIDE_INSET_PX;
    const maxLeft = Math.max(
        minLeft,
        rootRect.width - STREAMING_PENCIL_WIDTH_PX - STREAMING_PENCIL_SIDE_INSET_PX
    );
    const travel = Math.max(0, maxLeft - minLeft);
    const desiredTop =
        getLastLineBottom(root, tail) + STREAMING_PENCIL_LAST_LINE_GAP_PX;

    return {
        left: minLeft,
        top: desiredTop,
        travel,
        durationMs: getStreamingTravelDurationMs(travel),
        mode: "streaming",
    };
}

function getIdlePencilState(root: HTMLElement): PencilState {
    const rootRect = root.getBoundingClientRect();
    const tail = findLastTextTail(root);
    const minLeft = STREAMING_PENCIL_SIDE_INSET_PX;
    const maxLeft = Math.max(
        minLeft,
        rootRect.width - STREAMING_PENCIL_WIDTH_PX - STREAMING_PENCIL_SIDE_INSET_PX
    );
    const anchoredLeft = tail
        ? clamp(
              tail.right + STREAMING_PENCIL_END_GAP_PX,
              minLeft,
              maxLeft
          )
        : clamp(
              rootRect.width / 2 - STREAMING_PENCIL_WIDTH_PX / 2,
              minLeft,
              maxLeft
          );
    const desiredTop =
        getLastLineBottom(root, tail) + STREAMING_PENCIL_LAST_LINE_GAP_PX;

    return {
        left: anchoredLeft,
        top: desiredTop,
        travel: 0,
        durationMs: STREAMING_PENCIL_MIN_DURATION_MS,
        mode: "idle",
    };
}

function getSettledPencilState(root: HTMLElement): PencilState {
    const rootRect = root.getBoundingClientRect();
    const tail = findLastTextTail(root);
    const { lineHeight } = getTextMetrics(root);
    const contentHeight = Math.max(root.scrollHeight, rootRect.height);
    const minLeft = STREAMING_PENCIL_SIDE_INSET_PX;
    const maxLeft = Math.max(
        minLeft,
        rootRect.width - STREAMING_PENCIL_WIDTH_PX - STREAMING_PENCIL_SIDE_INSET_PX
    );
    const desiredLeft = tail
        ? tail.right + STREAMING_PENCIL_END_GAP_PX
        : maxLeft;
    const desiredTop = tail
        ? tail.top + tail.height * 0.88
        : contentHeight + lineHeight * 0.2;

    return {
        left: clamp(desiredLeft, minLeft, maxLeft),
        top: desiredTop,
        travel: 0,
        durationMs: STREAMING_PENCIL_MIN_DURATION_MS,
        mode: "settled",
    };
}

function getLastLineBottom(
    root: HTMLElement,
    tail: ReturnType<typeof findLastTextTail>
) {
    if (tail) {
        return tail.bottom;
    }

    const rootRect = root.getBoundingClientRect();
    return Math.max(root.scrollHeight, rootRect.height);
}

function getStreamingTravelDurationMs(travel: number) {
    const roundTripDurationMs =
        (Math.max(travel, 1) / STREAMING_PENCIL_SCAN_SPEED_PX_PER_S) * 2000;

    return clamp(
        roundTripDurationMs,
        STREAMING_PENCIL_MIN_DURATION_MS,
        STREAMING_PENCIL_MAX_DURATION_MS
    );
}

function findLastTextTail(root: HTMLElement) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];

    let current = walker.nextNode();
    while (current) {
        const node = current as Text;
        const value = node.textContent ?? "";
        if (/\S/.test(value)) {
            textNodes.push(node);
        }
        current = walker.nextNode();
    }

    if (textNodes.length === 0) {
        return null;
    }

    const rootRect = root.getBoundingClientRect();

    for (let i = textNodes.length - 1; i >= 0; i--) {
        const node = textNodes[i];
        const value = node.textContent ?? "";
        let end = value.length;

        while (end > 0 && /\s/.test(value[end - 1])) {
            end--;
        }

        if (end <= 0) continue;

        const range = document.createRange();
        range.setStart(node, end - 1);
        range.setEnd(node, end);

        const rects = Array.from(range.getClientRects());
        const rect = rects[rects.length - 1] ?? range.getBoundingClientRect();

        if (!rect || (rect.width === 0 && rect.height === 0)) {
            continue;
        }

        return {
            right: rect.right - rootRect.left,
            top: rect.top - rootRect.top,
            height: rect.height,
            bottom: rect.bottom - rootRect.top,
        };
    }

    return null;
}

function getTextMetrics(root: HTMLElement) {
    const styles = window.getComputedStyle(root);
    const fontSize = Number.parseFloat(styles.fontSize) || 15;
    const lineHeight =
        styles.lineHeight === "normal"
            ? fontSize * 1.65
            : Number.parseFloat(styles.lineHeight) || fontSize * 1.65;

    return { fontSize, lineHeight };
}

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}
