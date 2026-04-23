"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatStatus, UIMessage } from "ai";
import { isToolUIPart } from "ai";
import { MessagePartRenderer } from "./message-parts";
import { ReasoningPart } from "./message-parts/reasoning-part";
import { StudyChatLoader } from "./StudyChatLoader";

type PartLike = { type?: string; text?: string };

function partitionPartsForRender(parts: PartLike[]) {
    type Row =
        | { kind: "reasoning"; start: number; end: number; text: string }
        | { kind: "other"; index: number };
    const rows: Row[] = [];
    let i = 0;
    while (i < parts.length) {
        const p = parts[i];
        if (p.type === "reasoning") {
            const start = i;
            const chunks: string[] = [(p.text ?? "")];
            while (i + 1 < parts.length && parts[i + 1].type === "reasoning") {
                i++;
                chunks.push(parts[i].text ?? "");
            }
            rows.push({
                kind: "reasoning",
                start,
                end: i,
                text: chunks.join("\n\n"),
            });
            i++;
        } else {
            rows.push({ kind: "other", index: i });
            i++;
        }
    }
    return rows;
}

interface MessagesProps {
    messages: UIMessage[];
    status: ChatStatus;
    isStreaming?: boolean;
    isTransitioning?: boolean;
    pendingUserText?: string | null;
}

function assistantHasVisibleContent(parts: unknown[]): boolean {
    for (const p of parts) {
        const part = p as { type?: string; text?: string };
        if (part.type === "reasoning") return true;
        if (part.type === "text" && part.text?.trim()) return true;
        if (isToolUIPart(p as never)) {
            return true;
        }
    }
    return false;
}

export const StudyMessages = memo(function StudyMessages({
    messages,
    status,
    isStreaming,
    isTransitioning,
    pendingUserText,
}: MessagesProps) {
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const userScrolledUp = useRef(false);
    const lastLenRef = useRef(messages.length);
    const clampRafRef = useRef<number | null>(null);
    const didInitialPositionRef = useRef(false);
    const awaitingSentBubbleRef = useRef(false);
    const [recentlySentUserId, setRecentlySentUserId] = useState<string | null>(null);

    const lastUserIndex = useMemo(() => {
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i]?.role === "user") return i;
        }
        return -1;
    }, [messages]);

    const firstUserIndex = useMemo(() => {
        for (let i = 0; i < messages.length; i++) {
            if (messages[i]?.role === "user") return i;
        }
        return -1;
    }, [messages]);

    const shouldShowBottomLoader = useMemo(() => {
        if (messages.length === 0 && isTransitioning) return true;
        const last = messages[messages.length - 1];
        if (!last) return false;
        if (last.role === "user") return true;
        if (status === "submitted") return true;
        if (status === "streaming" && last.role === "assistant") {
            const parts = Array.isArray(last.parts) ? last.parts : [];
            if (parts.length === 0) return true;
            return !assistantHasVisibleContent(parts);
        }
        return false;
    }, [isTransitioning, messages, status]);

    const shouldReserveLoaderMinHeight = shouldShowBottomLoader;

    const alignLastAnchorToVisibleBottom = useCallback(
        (selector: string, marginBottom: number) => {
            const el = scrollRef.current;
            if (!el) return;

            const anchors = el.querySelectorAll<HTMLElement>(selector);
            const anchor = anchors[anchors.length - 1];
            if (!anchor) return;

            const elRect = el.getBoundingClientRect();
            const anchorRect = anchor.getBoundingClientRect();
            const anchorBottomInContent =
                anchorRect.bottom - elRect.top + el.scrollTop;
            const desiredScrollTop = Math.max(
                0,
                anchorBottomInContent - (el.clientHeight - marginBottom)
            );

            if (Math.abs(el.scrollTop - desiredScrollTop) > 1) {
                el.scrollTop = desiredScrollTop;
            }
        },
        []
    );

    const clampScrollToFirstUser = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        const first = el.querySelector<HTMLElement>("[data-first-user-anchor]");
        if (!first) return;
        const pad = 8;
        const elRect = el.getBoundingClientRect();
        const firstRect = first.getBoundingClientRect();
        const topInContent =
            firstRect.top - elRect.top + el.scrollTop;
        const minScroll = Math.max(0, topInContent - pad);
        if (el.scrollTop < minScroll) {
            el.scrollTop = minScroll;
        }
    }, []);

    const keepLoaderJustVisible = useCallback(() => {
        alignLastAnchorToVisibleBottom("[data-study-loader-anchor]", 12);
    }, [alignLastAnchorToVisibleBottom]);

    const keepStreamingTailVisible = useCallback(() => {
        alignLastAnchorToVisibleBottom("[data-study-assistant-tail-anchor]", 20);
    }, [alignLastAnchorToVisibleBottom]);

    const handleScroll = useCallback(
        (el: HTMLDivElement) => {
            const nearBottom =
                el.scrollHeight - el.scrollTop - el.clientHeight < 140;
            userScrolledUp.current = !nearBottom;
            if (clampRafRef.current != null) return;
            clampRafRef.current = requestAnimationFrame(() => {
                clampRafRef.current = null;
                clampScrollToFirstUser();
            });
        },
        [clampScrollToFirstUser]
    );

    const showPendingBubble =
        Boolean(pendingUserText) &&
        !(messages[messages.length - 1]?.role === "user" &&
            extractUserMessageText(messages[messages.length - 1]) ===
                pendingUserText?.trim());

    useEffect(() => {
        if (messages.length === 0 && !showPendingBubble && !shouldShowBottomLoader) {
            didInitialPositionRef.current = false;
            lastLenRef.current = 0;
        }
    }, [messages.length, showPendingBubble, shouldShowBottomLoader]);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el || didInitialPositionRef.current) return;
        if (messages.length === 0 && !showPendingBubble && !shouldShowBottomLoader) {
            return;
        }

        didInitialPositionRef.current = true;

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (shouldShowBottomLoader) {
                    keepLoaderJustVisible();
                } else {
                    keepStreamingTailVisible();
                }
                clampScrollToFirstUser();
            });
        });
    }, [
        messages.length,
        showPendingBubble,
        shouldShowBottomLoader,
        clampScrollToFirstUser,
        keepLoaderJustVisible,
        keepStreamingTailVisible,
    ]);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const grew = messages.length !== lastLenRef.current;
        lastLenRef.current = messages.length;
        const last = messages[messages.length - 1];
        const shouldFollowStreaming =
            isStreaming && last?.role === "assistant";
        if (shouldShowBottomLoader || shouldFollowStreaming) {
            return;
        }
        if (
            userScrolledUp.current &&
            !grew &&
            !isTransitioning &&
            !shouldFollowStreaming
        ) {
            return;
        }
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (
                    userScrolledUp.current &&
                    !grew &&
                    !isTransitioning &&
                    !shouldFollowStreaming
                ) {
                    return;
                }
                if (shouldShowBottomLoader) {
                    keepLoaderJustVisible();
                } else if (shouldFollowStreaming) {
                    keepStreamingTailVisible();
                } else if (grew) {
                    const anchor = el.querySelector<HTMLElement>(
                        '[data-last-user="true"]'
                    );
                    if (anchor) {
                        const elRect = el.getBoundingClientRect();
                        const anchorRect = anchor.getBoundingClientRect();
                        const anchorBottomInContent =
                            anchorRect.bottom - elRect.top + el.scrollTop;
                        const visibleBottom = el.scrollTop + el.clientHeight - 72;
                        if (anchorBottomInContent > visibleBottom) {
                            el.scrollTop += anchorBottomInContent - visibleBottom;
                        }
                    }
                }
                clampScrollToFirstUser();
            });
        });
    }, [
        messages,
        isStreaming,
        isTransitioning,
        shouldShowBottomLoader,
        clampScrollToFirstUser,
        keepLoaderJustVisible,
        keepStreamingTailVisible,
    ]);

    useEffect(() => {
        const el = scrollRef.current;
        const last = messages[messages.length - 1];
        const shouldFollowStreaming =
            isStreaming && last?.role === "assistant";
        if (!el || (!shouldShowBottomLoader && !shouldFollowStreaming)) return;

        let frame = 0;
        let resizeObserver: ResizeObserver | null = null;
        const observeTarget =
            el.firstElementChild instanceof HTMLElement ? el.firstElementChild : el;

        const sync = () => {
            frame = 0;
            if (shouldShowBottomLoader) {
                keepLoaderJustVisible();
            } else {
                keepStreamingTailVisible();
            }
            clampScrollToFirstUser();
        };

        const scheduleSync = () => {
            if (frame !== 0) return;
            frame = window.requestAnimationFrame(sync);
        };

        scheduleSync();

        const observer = new MutationObserver(scheduleSync);
        observer.observe(observeTarget, {
            subtree: true,
            childList: true,
            characterData: true,
        });

        if (typeof ResizeObserver !== "undefined") {
            resizeObserver = new ResizeObserver(scheduleSync);
            resizeObserver.observe(el);
            resizeObserver.observe(observeTarget);
        }

        window.addEventListener("resize", scheduleSync);

        return () => {
            observer.disconnect();
            resizeObserver?.disconnect();
            window.removeEventListener("resize", scheduleSync);
            if (frame !== 0) {
                window.cancelAnimationFrame(frame);
            }
        };
    }, [
        messages,
        isStreaming,
        shouldShowBottomLoader,
        clampScrollToFirstUser,
        keepLoaderJustVisible,
        keepStreamingTailVisible,
    ]);

    const activeAnimatedUserId = useMemo(() => {
        const last = lastUserIndex >= 0 ? messages[lastUserIndex] : null;
        if (
            pendingUserText &&
            last?.role === "user" &&
            extractUserMessageText(last) === pendingUserText.trim()
        ) {
            return last.id;
        }
        return recentlySentUserId;
    }, [lastUserIndex, messages, pendingUserText, recentlySentUserId]);

    useEffect(() => {
        if (pendingUserText) {
            awaitingSentBubbleRef.current = true;
        }
    }, [pendingUserText]);

    useEffect(() => {
        if (!awaitingSentBubbleRef.current) return;
        const lastUser = lastUserIndex >= 0 ? messages[lastUserIndex] : null;
        if (!lastUser || lastUser.role !== "user") return;
        setRecentlySentUserId(lastUser.id);
        awaitingSentBubbleRef.current = false;
    }, [lastUserIndex, messages]);

    useEffect(() => {
        if (!recentlySentUserId) return;
        const timeout = window.setTimeout(() => {
            setRecentlySentUserId((current) =>
                current === recentlySentUserId ? null : current
            );
        }, 520);
        return () => {
            window.clearTimeout(timeout);
        };
    }, [recentlySentUserId]);

    useEffect(() => {
        if (!showPendingBubble) return;
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                keepLoaderJustVisible();
                clampScrollToFirstUser();
            });
        });
    }, [showPendingBubble, clampScrollToFirstUser, keepLoaderJustVisible]);

    return (
        <div
            ref={scrollRef}
            onScroll={(e) => handleScroll(e.currentTarget)}
            className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain"
            style={{ overflowAnchor: "none" }}
        >
            <div className="mx-auto flex w-full max-w-3xl flex-col space-y-0 px-4 pt-6 pb-[9.5rem] sm:px-6 sm:pt-8 sm:pb-44">
                {showPendingBubble && (
                    <div
                        className="mb-0 flex justify-end study-user-turn study-user-turn--entering"
                        data-last-user="true"
                        data-first-user-anchor=""
                    >
                        <UserBubble text={pendingUserText ?? ""} animateIn />
                    </div>
                )}

                {messages.map((message, idx) => {
                    const isUser = message.role === "user";
                    const parts = Array.isArray(message.parts) ? message.parts : [];
                    const isLastMsg = idx === messages.length - 1;
                    const nextIsAssistant =
                        idx < messages.length - 1 &&
                        messages[idx + 1]?.role === "assistant";

                    const turnClass = isUser
                        ? nextIsAssistant
                            ? "mb-0"
                            : "mb-4"
                        : isLastMsg
                          ? "mb-0"
                          : "mb-8 border-b border-black/10 pb-6 dark:border-white/10";

                    if (isUser) {
                        const text = parts
                            .filter((p) => (p as { type?: string }).type === "text")
                            .map((p) => (p as { text?: string }).text ?? "")
                            .join("\n");
                        const isFirstUser = idx === firstUserIndex;
                        return (
                            <div
                                key={message.id}
                                data-last-user={
                                    idx === lastUserIndex ? "true" : undefined
                                }
                                data-first-user-anchor={isFirstUser ? "" : undefined}
                                className={`flex justify-end ${turnClass} study-user-turn ${
                                    message.id === activeAnimatedUserId
                                        ? "study-user-turn--entering"
                                        : ""
                                }`}
                            >
                                <UserBubble
                                    text={text}
                                    animateIn={message.id === activeAnimatedUserId}
                                />
                            </div>
                        );
                    }

                    const showAssistantPlaceholder =
                        parts.length === 0 &&
                        isLastMsg &&
                        isStreaming &&
                        shouldShowBottomLoader;

                    const content = showAssistantPlaceholder ? null : (
                        partitionPartsForRender(parts).map((row) => {
                            if (row.kind === "reasoning") {
                                const isStreamingReasoning =
                                    isLastMsg &&
                                    isStreaming &&
                                    row.end === parts.length - 1;
                                return (
                                    <ReasoningPart
                                        key={`${message.id}-reasoning-${row.start}-${row.end}`}
                                        id={`${message.id}-reasoning-${row.start}`}
                                        text={row.text}
                                        isStreaming={isStreamingReasoning}
                                    />
                                );
                            }
                            const pIdx = row.index;
                            const part = parts[pIdx];
                            return (
                                <MessagePartRenderer
                                    key={`${message.id}-${pIdx}-${part.type}`}
                                    part={
                                        part as Parameters<
                                            typeof MessagePartRenderer
                                        >[0]["part"]
                                    }
                                    messageId={message.id}
                                    partIndex={pIdx}
                                    isResponseTail={
                                        isLastMsg &&
                                        pIdx === parts.length - 1
                                    }
                                    isStreaming={
                                        isLastMsg &&
                                        isStreaming &&
                                        pIdx === parts.length - 1
                                    }
                                />
                            );
                        })
                    );

                    return (
                        <div
                            key={message.id}
                            className={`flex w-full flex-col gap-3 text-black dark:text-[#D5D5D5] ${turnClass}`}
                        >
                            {content}
                            {isLastMsg && (
                                <div
                                    aria-hidden="true"
                                    data-study-assistant-tail-anchor=""
                                    className="h-px w-px"
                                />
                            )}
                        </div>
                    );
                })}

                {shouldShowBottomLoader && (
                    <div
                        className={`mt-1 flex items-start ${shouldReserveLoaderMinHeight ? "min-h-[calc(100vh-18rem)]" : ""}`}
                    >
                        <StudyChatLoader />
                    </div>
                )}
            </div>
        </div>
    );
});

function UserBubble({
    text,
    animateIn,
}: {
    text: string;
    animateIn?: boolean;
}) {
    return (
        <div
            className={[
                "study-user-bubble",
                animateIn ? "study-user-bubble--entering" : "",
            ].join(" ")}
        >
            <span className="study-user-bubble__body">
                <span className="study-user-bubble__text">{text}</span>
            </span>
        </div>
    );
}

function extractUserMessageText(message: UIMessage | undefined | null) {
    if (!message || message.role !== "user") return "";
    const parts = Array.isArray(message.parts) ? message.parts : [];
    return parts
        .filter((p) => (p as { type?: string }).type === "text")
        .map((p) => (p as { text?: string }).text?.trim() ?? "")
        .join("\n")
        .trim();
}
