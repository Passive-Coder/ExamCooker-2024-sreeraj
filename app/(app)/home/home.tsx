import React, { Suspense } from "react";
import { auth } from "@/app/auth";
import UserName from "./display_username";
import { GradientText } from "@/app/components/landing_page/landing";
import ExamCookerLogo from "@/app/components/common/ExamCookerLogo";
import ExamsMarquee from "./ExamsMarquee";
import { getSearchableCourses } from "@/lib/data/courseCatalog";
import { getUpcomingExams } from "@/lib/data/upcomingExams";
import CourseSearch from "./CourseSearch";
import HomeMarketingSections from "./HomeMarketingSections";
import WelcomeBackSubtitle from "./WelcomeBackSubtitle";
import CourseBackdrop from "./CourseBackdrop";

const HOME_SUBTITLE = "Your one-stop solution to cram before exams.";

function HomeSearchSection({ courses }: { courses: Awaited<ReturnType<typeof getSearchableCourses>> }) {
    return (
        <div className="mx-auto w-full max-w-4xl px-4 sm:px-0">
            <CourseSearch courses={courses} />
        </div>
    );
}

const subtitleClass =
    "text-base md:text-xl text-black/70 dark:text-[#D5D5D5]/70 max-w-2xl mx-auto";

async function HomeSubtitle() {
    const session = await auth();
    if (!session?.user) {
        return <p className={subtitleClass}>{HOME_SUBTITLE}</p>;
    }
    return (
        <WelcomeBackSubtitle className={subtitleClass}>
            Welcome back, <UserName />
        </WelcomeBackSubtitle>
    );
}

const Home = async () => {
    const [courses, upcomingExams] = await Promise.all([
        getSearchableCourses(),
        getUpcomingExams(16),
    ]);

    return (
        <div className="overflow-x-clip bg-[#C2E6EC] dark:bg-[hsl(224,48%,9%)] text-black dark:text-[#D5D5D5] flex flex-col transition-colors">
            <section className="relative isolate min-h-screen overflow-hidden">
                <CourseBackdrop courses={courses} />

                <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 sm:px-6 lg:px-8">
                    <div className="relative flex flex-1 flex-col justify-center py-10 text-center md:py-14">
                        <div className="relative z-20 mb-8 flex flex-col items-center md:mb-10">
                            <div className="relative inline-flex items-center justify-center px-4 py-3 sm:px-5 sm:py-4">
                                <div
                                    aria-hidden="true"
                                    className="pointer-events-none absolute inset-0 bg-[#C2E6EC] dark:bg-[hsl(224,48%,9%)]"
                                    style={{
                                        WebkitMaskImage:
                                            "radial-gradient(ellipse at center, black 0%, black 64%, rgba(0,0,0,0.9) 78%, transparent 100%)",
                                        maskImage:
                                            "radial-gradient(ellipse at center, black 0%, black 64%, rgba(0,0,0,0.9) 78%, transparent 100%)",
                                        filter: "blur(12px)",
                                    }}
                                />
                                <div className="relative z-10">
                                    <ExamCookerLogo />
                                </div>
                            </div>
                        </div>

                        <div className="relative z-10 mx-auto mb-6 inline-flex flex-col items-center px-5 py-4 sm:px-7 sm:py-5 lg:px-8 lg:py-6">
                            <div
                                aria-hidden="true"
                                className="pointer-events-none absolute inset-0 bg-[#C2E6EC] dark:bg-[hsl(224,48%,9%)]"
                                style={{
                                    WebkitMaskImage:
                                        "radial-gradient(ellipse at center, black 0%, black 62%, rgba(0,0,0,0.94) 76%, transparent 100%)",
                                    maskImage:
                                        "radial-gradient(ellipse at center, black 0%, black 62%, rgba(0,0,0,0.94) 76%, transparent 100%)",
                                    filter: "blur(16px)",
                                }}
                            />
                            <h1 className="relative text-5xl md:text-7xl lg:text-8xl font-extrabold leading-[1.02] drop-shadow-[0px_2px_rgba(59,244,199,1)]">
                                <GradientText>Cramming,</GradientText>
                            </h1>
                            <h1 className="relative text-5xl md:text-7xl lg:text-8xl font-extrabold leading-[1.02]">
                                Made Easy.
                            </h1>
                        </div>
                        <div className="relative z-10 mx-auto mb-10 inline-flex items-center justify-center px-4 py-2 sm:px-5">
                            <div
                                aria-hidden="true"
                                className="pointer-events-none absolute inset-0 bg-[#C2E6EC] dark:bg-[hsl(224,48%,9%)]"
                                style={{
                                    WebkitMaskImage:
                                        "radial-gradient(ellipse at center, black 0%, black 58%, rgba(0,0,0,0.84) 74%, transparent 100%)",
                                    maskImage:
                                        "radial-gradient(ellipse at center, black 0%, black 58%, rgba(0,0,0,0.84) 74%, transparent 100%)",
                                    filter: "blur(10px)",
                                }}
                            />
                            <div className="relative z-10">
                                <Suspense fallback={<p className={subtitleClass}>{HOME_SUBTITLE}</p>}>
                                    <HomeSubtitle />
                                </Suspense>
                            </div>
                        </div>

                        <div className="relative z-10">
                            <HomeSearchSection courses={courses} />
                        </div>
                    </div>

                    <div className="relative z-10 pb-4 md:pb-6">
                        <Suspense fallback={null}>
                            <ExamsMarquee items={upcomingExams} />
                        </Suspense>
                    </div>
                </div>

                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(194,230,236,0.26)_100%)] dark:bg-[radial-gradient(circle_at_center,transparent_0%,rgba(12,18,34,0.32)_100%)]" />
            </section>

            <Suspense fallback={null}>
                <HomeMarketingSections />
            </Suspense>
        </div>
    );
};

export default Home;
