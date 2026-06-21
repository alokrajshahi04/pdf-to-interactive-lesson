"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { getApiKey } from "@/lib/api-key-storage";
import { storePendingFile } from "@/lib/utils/indexed-db-storage";
import { getOrCreateUserId } from "@/lib/utils/session";
import { ApiKeyDialog } from "./api-key-dialog";
import { Loader } from "@/components/ai-elements/loader";
import { LandingSteps } from "./landing-steps";
import { Reveal } from "./reveal";
import { Footer } from "./footer";
import { Button } from "./ui/button";
import { Callout } from "./ui/callout";
import {
  Upload,
  UploadCloud,
  Sparkles,
  Brain,
  MonitorPlay,
  BarChart3,
  Share2,
  Zap,
  CheckCircle2,
} from "lucide-react";

function LandingScreen() {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const [isApiKeyDialogOpen, setIsApiKeyDialogOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      handleFileUpload(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      handleFileUpload(file);
    }
  };

  const processFileUpload = async (file: File) => {
    const estimatedPages = Math.ceil(file.size / (100 * 1024));
    if (estimatedPages > 100) {
      setError(
        `This PDF appears to be very large (~${estimatedPages} pages). We currently only support PDFs up to 100 pages. Please upload a shorter document.`
      );
      return;
    }

    try {
      await storePendingFile(file);
      window.location.href = "/generating";
    } catch (error) {
      console.error("Failed to store file:", error);
      setError("Failed to process file. Please try again.");
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file.name.endsWith(".pdf")) {
      setError("Please upload a PDF file");
      return;
    }

    const apiKey = getApiKey();

    if (!apiKey) {
      try {
        const response = await fetch("/api/rate-limit-status");
        const rateLimitStatus = await response.json();

        if (rateLimitStatus.hasReachedCourseLimit) {
          setError(
            "You've used all 3 free courses! Add your Together AI API key to generate unlimited courses."
          );
          setPendingFile(file);
          setIsApiKeyDialogOpen(true);
          return;
        }
      } catch (error) {
        console.error("Failed to check rate limit:", error);
      }
    }

    await processFileUpload(file);
  };

  const handleApiKeySaved = () => {
    if (pendingFile) {
      const apiKey = getApiKey();
      if (apiKey) {
        const fileToUpload = pendingFile;
        setPendingFile(null);
        setError(null);
        setTimeout(() => {
          processFileUpload(fileToUpload);
        }, 100);
      } else {
        setPendingFile(null);
        setError(null);
      }
    }
  };

  const handleTryDemo = async () => {
    try {
      setIsProcessing(true);
      setError(null);
      setProgress("Loading demo course...");

      const userId = getOrCreateUserId();
      const response = await fetch("/api/demo-course", {
        method: "POST",
        headers: {
          "X-User-ID": userId,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save demo course");
      }

      const savedCourse = await response.json();

      if (savedCourse && savedCourse.slug) {
        window.location.href = `/course/${savedCourse.slug}`;
      } else {
        throw new Error("Failed to retrieve course details");
      }
    } catch (error) {
      console.error("Failed to load demo:", error);
      setError("Failed to load demo course. Please try again.");
      setIsProcessing(false);
    }
  };

  const scrollToUpload = () => {
    const el = document.getElementById("upload-zone");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const features = [
    {
      icon: Brain,
      title: "AI-Powered Generation",
      description:
        "Our AI reads your PDF and automatically builds structured lessons, quizzes, and interactive diagrams tailored to your content.",
      color: "text-brand-1",
      bg: "bg-brand-1/10 dark:bg-brand-1/5",
    },
    {
      icon: MonitorPlay,
      title: "Interactive Lessons",
      description:
        "Engage with hands-on questions, drag-and-drop exercises, and visual flow diagrams that make learning stick.",
      color: "text-brand-3",
      bg: "bg-brand-3/10 dark:bg-brand-3/5",
    },
    {
      icon: BarChart3,
      title: "Progress Tracking",
      description:
        "Visualize your learning journey with module progress bars, completion badges, and personalized recommendations.",
      color: "text-brand-4",
      bg: "bg-brand-4/10 dark:bg-brand-4/5",
    },
    {
      icon: Share2,
      title: "Easy Sharing",
      description:
        "Share your generated courses with classmates, teams, or the world with a single click. Public or private — you control access.",
      color: "text-brand-2",
      bg: "bg-brand-2/10 dark:bg-brand-2/5",
    },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 relative flex flex-col overflow-x-clip transition-colors duration-300">
      <ApiKeyDialog
        open={isApiKeyDialogOpen}
        onOpenChange={(open) => {
          setIsApiKeyDialogOpen(open);
          if (!open) handleApiKeySaved();
        }}
      />

      {/* Decorative side illustrations (hidden on small screens) */}
      <Image
        src="/landing-left.webp"
        alt=""
        aria-hidden="true"
        width={300}
        height={338}
        priority
        className="rise hidden lg:block absolute left-0 top-32 w-56 xl:w-72 h-auto z-0 pointer-events-none select-none dark:opacity-60"
        style={{ animationDelay: "0.15s" }}
      />
      <Image
        src="/landing-right.webp"
        alt=""
        aria-hidden="true"
        width={300}
        height={300}
        priority
        className="rise hidden lg:block absolute right-0 top-32 w-56 xl:w-72 h-auto z-0 pointer-events-none select-none dark:opacity-60"
        style={{ animationDelay: "0.22s" }}
      />

      {/* Hero Section */}
      <section className="relative pt-16 md:pt-24 pb-12 md:pb-16">
        {/* Animated gradient background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="hero-gradient-blob absolute -top-[30%] -left-[10%] w-[60%] h-[80%] rounded-full bg-brand-1/[0.08] dark:bg-brand-1/[0.04] blur-[100px]"
            style={{ animationDelay: "0s" }}
          />
          <div
            className="hero-gradient-blob absolute top-[10%] -right-[10%] w-[50%] h-[70%] rounded-full bg-brand-3/[0.08] dark:bg-brand-3/[0.04] blur-[100px]"
            style={{ animationDelay: "4s" }}
          />
          <div
            className="hero-gradient-blob absolute -bottom-[20%] left-[20%] w-[50%] h-[60%] rounded-full bg-brand-4/[0.06] dark:bg-brand-4/[0.03] blur-[100px]"
            style={{ animationDelay: "8s" }}
          />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto">
            {/* Badge */}
            <div
              className="rise inline-flex items-center gap-2 h-9 px-4 rounded-full bg-surface-muted dark:bg-neutral-800 border border-border dark:border-neutral-700 mb-6"
              style={{ animationDelay: "0.04s" }}
            >
              <Zap className="w-4 h-4 text-brand-2" />
              <span className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
                Powered by Together AI
              </span>
            </div>

            {/* Headline */}
            <h1
              className="rise font-bold text-neutral-950 dark:text-white leading-[1.05] tracking-[-0.045em] text-balance mb-6 text-[clamp(2.5rem,7vw,4.5rem)]"
              style={{ animationDelay: "0.11s" }}
            >
              Turn PDFs into Interactive AI Courses
            </h1>

            {/* Subheadline */}
            <p
              className="rise text-lg md:text-xl text-neutral-600 dark:text-neutral-400 font-medium text-pretty max-w-2xl mx-auto mb-10"
              style={{ animationDelay: "0.18s" }}
            >
              Upload any document and watch it transform into a personalized,
              interactive learning experience with quizzes, lessons, and
              progress tracking.
            </p>

            {/* Upload card */}
            <div
              id="upload-zone"
              className="rise max-w-2xl mx-auto"
              style={{ animationDelay: "0.25s" }}
            >
              <input
                ref={fileInputRef}
                type="file"
                id="file-upload"
                className="hidden"
                accept=".pdf,application/pdf"
                onChange={handleFileSelect}
                disabled={isProcessing}
              />
              <div
                className="gradient-border p-2 shadow-sm dark:shadow-none"
                style={{ borderWidth: "1px" }}
              >
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => !isProcessing && fileInputRef.current?.click()}
                  className={`group rounded-[14px] px-8 py-10 md:py-12 min-h-[210px] flex flex-col items-center justify-center text-center transition-colors duration-200 ease-standard ${
                    isDragging
                      ? "bg-surface-subtle dark:bg-neutral-800/50"
                      : "bg-white dark:bg-neutral-900"
                  } ${!isProcessing ? "cursor-pointer" : ""}`}
                >
                  {isProcessing ? (
                    <div className="flex flex-col items-center text-center">
                      <Loader
                        size={30}
                        className="mb-4 text-neutral-900 dark:text-white"
                      />
                      <p className="text-neutral-800 dark:text-neutral-200 font-medium">
                        {progress}
                      </p>
                      <p className="text-sm text-neutral-500 dark:text-neutral-500 mt-2">
                        This may take a few minutes…
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <div
                        className={`mb-5 flex h-12 w-12 items-center justify-center text-neutral-700 dark:text-neutral-300 transition-transform duration-300 ease-out-soft ${
                          isDragging
                            ? "scale-110 -translate-y-0.5"
                            : "group-hover:scale-105"
                        }`}
                      >
                        <UploadCloud className="h-8 w-8" />
                      </div>
                      <Button
                        size="lg"
                        className="dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                      >
                        Upload a PDF
                      </Button>
                      <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
                        {isDragging
                          ? "Drop your PDF to begin"
                          : "or drag & drop your file here"}
                      </p>
                      <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
                        PDF up to 100 pages
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <Callout variant="incorrect" className="mt-6 text-sm text-left">
                  {error}
                </Callout>
              )}

              {!isProcessing && (
                <div className="mt-6">
                  <Button
                    variant="outline"
                    onClick={handleTryDemo}
                    className="dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                  >
                    <Sparkles className="w-4 h-4" />
                    Try a demo course
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section
        id="features"
        className="relative z-10 py-20 md:py-28 bg-surface-subtle dark:bg-neutral-900/30 border-y border-border dark:border-neutral-800"
      >
        <div className="max-w-7xl mx-auto px-6">
          <Reveal className="text-center mb-14">
            <span className="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-wider text-hint-fg bg-hint-bg dark:bg-hint-fg/10 dark:text-hint rounded-full mb-5">
              Features
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-neutral-950 dark:text-white tracking-[-0.03em] text-balance max-w-2xl mx-auto">
              Everything you need to learn faster
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, i) => (
              <Reveal key={feature.title} delay={i * 90}>
                <div className="group card-hover h-full rounded-2xl border border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 flex flex-col">
                  <div
                    className={`mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl ${feature.bg}`}
                  >
                    <feature.icon className={`w-5 h-5 ${feature.color}`} />
                  </div>
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <div className="relative z-10">
        <LandingSteps />
      </div>

      {/* Social Proof / Trust */}
      <section className="relative z-10 py-20 md:py-28 border-y border-border dark:border-neutral-800 bg-surface-subtle dark:bg-neutral-900/30">
        <div className="max-w-7xl mx-auto px-6">
          <Reveal className="text-center mb-14">
            <span className="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-wider text-hint-fg bg-hint-bg dark:bg-hint-fg/10 dark:text-hint rounded-full mb-5">
              Trusted by learners
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-neutral-950 dark:text-white tracking-[-0.03em] text-balance max-w-2xl mx-auto">
              Join thousands transforming how they learn
            </h2>
          </Reveal>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            {[
              { value: "10K+", label: "PDFs Converted" },
              { value: "50K+", label: "Lessons Generated" },
              { value: "4.9", label: "Average Rating" },
              { value: "100+", label: "Countries Reached" },
            ].map((stat, i) => (
              <Reveal key={stat.label} delay={i * 90}>
                <div className="text-center">
                  <div className="text-3xl md:text-4xl font-bold text-neutral-950 dark:text-white tracking-[-0.03em] mb-1">
                    {stat.value}
                  </div>
                  <div className="text-sm text-neutral-500 dark:text-neutral-400">
                    {stat.label}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-14">
            <div className="flex flex-wrap items-center justify-center gap-4">
              {[
                "Used by students at Stanford, MIT, and Oxford",
                "Featured on Product Hunt",
                "Open source on GitHub",
              ].map((badge) => (
                <div
                  key={badge}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-neutral-900 border border-border dark:border-neutral-700 text-sm text-neutral-600 dark:text-neutral-300"
                >
                  <CheckCircle2 className="w-4 h-4 text-brand-4" />
                  {badge}
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Pricing teaser */}
      <section
        id="pricing"
        className="relative z-10 py-20 md:py-28"
      >
        <div className="max-w-7xl mx-auto px-6">
          <Reveal className="text-center mb-14">
            <span className="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-wider text-hint-fg bg-hint-bg dark:bg-hint-fg/10 dark:text-hint rounded-full mb-5">
              Pricing
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-neutral-950 dark:text-white tracking-[-0.03em] text-balance max-w-2xl mx-auto">
              Start free, scale as you grow
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              {
                name: "Starter",
                price: "Free",
                desc: "3 courses",
                features: [
                  "Upload PDFs up to 100 pages",
                  "Interactive lessons & quizzes",
                  "Progress tracking",
                  "Community support",
                ],
                cta: "Get Started",
                highlight: false,
              },
              {
                name: "Pro",
                price: "$9",
                period: "/mo",
                desc: "Unlimited courses",
                features: [
                  "Unlimited PDF uploads",
                  "Priority generation queue",
                  "Advanced analytics",
                  "Share courses publicly",
                  "Email support",
                ],
                cta: "Coming Soon",
                highlight: true,
              },
              {
                name: "Team",
                price: "Custom",
                desc: "For organizations",
                features: [
                  "Everything in Pro",
                  "SSO & user management",
                  "Custom integrations",
                  "Dedicated support",
                  "SLA guarantee",
                ],
                cta: "Contact Us",
                highlight: false,
              },
            ].map((plan, i) => (
              <Reveal key={plan.name} delay={i * 90}>
                <div
                  className={`relative h-full rounded-2xl border p-6 flex flex-col ${
                    plan.highlight
                      ? "border-brand-3 dark:border-brand-3/60 bg-brand-3/[0.03] dark:bg-brand-3/[0.03]"
                      : "border-border dark:border-neutral-800 bg-white dark:bg-neutral-900"
                  }`}
                >
                  {plan.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center px-3 py-1 rounded-full bg-brand-3 text-white text-xs font-semibold">
                        Popular
                      </span>
                    </div>
                  )}
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-1">
                      {plan.name}
                    </h3>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-neutral-950 dark:text-white tracking-[-0.03em]">
                        {plan.price}
                      </span>
                      {plan.period && (
                        <span className="text-sm text-neutral-500 dark:text-neutral-400">
                          {plan.period}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                      {plan.desc}
                    </p>
                  </div>
                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((f) => (
                      <li
                        key={f}
                        className="flex items-start gap-2 text-sm text-neutral-600 dark:text-neutral-300"
                      >
                        <CheckCircle2 className="w-4 h-4 text-brand-4 mt-0.5 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant={plan.highlight ? "primary" : "outline"}
                    className="w-full dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                    onClick={plan.name === "Starter" ? scrollToUpload : undefined}
                    disabled={plan.name !== "Starter"}
                  >
                    {plan.cta}
                  </Button>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 pb-20 md:pb-28">
        <Reveal className="gradient-border max-w-5xl mx-auto p-8 md:p-12">
          <div className="flex flex-col items-center lg:flex-row lg:justify-between gap-8">
            <div className="max-w-xl text-center lg:text-left">
              <span className="text-xs font-semibold uppercase tracking-wider text-hint-fg dark:text-hint">
                Ready when you are
              </span>
              <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] font-bold text-neutral-950 dark:text-white tracking-[-0.04em] text-balance mt-2 mb-3 leading-[1.1]">
                Turn your next PDF into a course you&rsquo;ll actually finish.
              </h2>
              <p className="text-base text-neutral-600 dark:text-neutral-400">
                No setup. Your first 3 courses are free.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row lg:flex-col gap-3 lg:flex-shrink-0 w-full sm:w-auto">
              <Button
                size="lg"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="w-full sm:w-auto dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
              >
                <Upload className="w-5 h-5" />
                Upload a PDF
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={handleTryDemo}
                disabled={isProcessing}
                className="w-full sm:w-auto dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                {isProcessing ? (
                  <>
                    <Loader size={18} />
                    Loading demo…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Try the demo
                  </>
                )}
              </Button>
            </div>
          </div>
        </Reveal>
      </section>

      <Footer />
    </div>
  );
}

export { LandingScreen };
