import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ManualPage() {
    return (
        <div className="min-h-screen bg-white">
            {/* Header */}
            <header className="border-b border-slate-300 bg-white sticky top-0 z-50 shadow-sm">
                <div className="container mx-auto px-6 py-3 flex items-center justify-between max-w-7xl">
                    <Link href="/">
                        <Button variant="ghost" size="sm" className="gap-2 text-slate-700">
                            <ArrowLeft className="h-4 w-4" />
                            Back
                        </Button>
                    </Link>
                    <h1 className="text-xl font-bold text-slate-900">User Manual</h1>
                    <div className="w-16" />
                </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto px-6 py-12 max-w-6xl text-lg">
                {/* Title Page Style */}
                <div className="text-center mb-16 pb-8 border-b border-slate-200">
                    <h1 className="text-5xl font-bold mb-4 text-slate-900">
                        Auto Academic Paper
                    </h1>
                    <p className="text-3xl font-medium text-slate-700 mb-2">User Manual</p>
                    <p className="text-sm text-slate-600 italic mt-6">Version 1.9</p>
                </div>

                {/* Abstract */}
                <div className="mb-12 px-4 md:px-12 max-w-4xl mx-auto">
                    <p className="text-center font-bold mb-3 text-sm uppercase tracking-wide">Abstract</p>
                    <p className="text-justify leading-relaxed text-slate-800">
                        This document describes the operation and configuration of the Auto Academic Paper system,
                        a tool for transforming draft documents into publication-ready academic papers using AI-powered
                        research pipelines, citation verification, and professional LaTeX formatting. The system implements
                        a six-phase processing architecture with configurable AI providers and produces compile-ready LaTeX output.
                    </p>
                </div>

                {/* Table of Contents */}
                <div className="mb-12 max-w-4xl mx-auto">
                    <h2 className="text-2xl font-bold mb-4 text-slate-900">Contents</h2>
                    <nav className="pl-6">
                        <ol className="space-y-2">
                            {[
                                { num: "1", title: "Quick Start Guide", href: "#quick-start" },
                                { num: "2", title: "AI Provider Configuration", href: "#ai-config" },
                                { num: "3", title: "Document Upload and Settings", href: "#upload" },
                                { num: "4", title: "Processing Pipeline", href: "#pipeline" },
                                { num: "5", title: "Preview and Export", href: "#preview" },
                                { num: "6", title: "Troubleshooting", href: "#troubleshooting" },
                                { num: "7", title: "LaTeX Compatibility Reference", href: "#latex" },
                            ].map((item) => (
                                <li key={item.href}>
                                    <a
                                        href={item.href}
                                        className="text-slate-700 hover:text-blue-800 hover:underline transition-colors"
                                    >
                                        <span className="inline-block w-8 font-medium">{item.num}.</span>
                                        {item.title}
                                    </a>
                                </li>
                            ))}
                        </ol>
                    </nav>
                </div>

                {/* Sections */}
                <div className="space-y-16 text-slate-800 leading-relaxed max-w-4xl mx-auto">
                    {/* Section 1 */}
                    <section id="quick-start" className="scroll-mt-24">
                        <h2 className="text-3xl font-bold mb-6 pb-2 border-b border-slate-200">
                            1. Quick Start Guide
                        </h2>

                        <div className="space-y-4">
                            <p className="text-lg">
                                The following procedure describes the minimal steps required to process a document.
                                New users should complete these steps in order.
                            </p>

                            <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 space-y-6">
                                <div>
                                    <h3 className="text-xl font-semibold mb-2 text-slate-900">1.1 Configure AI Providers</h3>
                                    <p className="pl-1">
                                        Navigate to <span className="font-semibold">Settings</span> and configure API keys for at least three providers
                                        (Writer, Librarian, Strategist). The system supports OpenRouter, Poe, Anthropic,
                                        Gemini, Grok, OpenAI, and Ollama. This configuration is required once per installation.
                                    </p>
                                </div>

                                <div>
                                    <h3 className="text-xl font-semibold mb-2 text-slate-900">1.2 Upload Document</h3>
                                    <p className="pl-1">
                                        Upload a source document in <code className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-sm font-mono text-slate-600">.txt</code>, {' '}
                                        <code className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-sm font-mono text-slate-600">.pdf</code>, or {' '}
                                        <code className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-sm font-mono text-slate-600">.md</code> format.
                                        Recommended length: 1,000–20,000 words.
                                    </p>
                                </div>

                                <div>
                                    <h3 className="text-xl font-semibold mb-2 text-slate-900">1.3 Select Parameters</h3>
                                    <p className="pl-1">
                                        Choose paper type (Research Paper, Essay, or Thesis), enhancement level (Standard recommended),
                                        and optionally provide author information.
                                    </p>
                                </div>

                                <div>
                                    <h3 className="text-xl font-semibold mb-2 text-slate-900">1.4 Submit Job</h3>
                                    <p className="pl-1">
                                        Click <span className="font-semibold">Submit Job</span>. Processing duration: 10–18 minutes.
                                        Progress is displayed in real time through six phases.
                                    </p>
                                </div>

                                <div>
                                    <h3 className="text-xl font-semibold mb-2 text-slate-900">1.5 Review and Export</h3>
                                    <p className="pl-1">
                                        Review the generated preview and download the <code className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-sm font-mono text-slate-600">.tex</code> file.
                                        Compile locally using <code className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-sm font-mono text-slate-600">pdflatex</code>.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Section 2 */}
                    <section id="ai-config" className="scroll-mt-20">
                        <h2 className="text-2xl font-bold mb-6 pb-2 border-b-2 border-slate-800">
                            2. AI Provider Configuration
                        </h2>

                        <div className="space-y-4">
                            <p className="text-justify">
                                This system implements a Bring-Your-Own-Keys (BYOK) architecture. Users must provide API keys
                                for external AI services. Three distinct agents are required:
                            </p>

                            <div className="pl-6">
                                <p className="font-semibold mb-2">2.1 Required Agents</p>
                                <ul className="list-disc pl-6 space-y-2">
                                    <li><strong>Writer:</strong> Generates section content. Recommended: Claude 4.5 Opus, GPT-5.2.</li>
                                    <li><strong>Librarian:</strong> Searches academic databases. Recommended: Gemini 3 Pro, Perplexity.</li>
                                    <li><strong>Strategist:</strong> Plans document structure. Recommended: Claude 4.5 Opus, GPT-5.2.</li>
                                </ul>
                            </div>

                            <div className="pl-6 mt-4">
                                <p className="font-semibold mb-2">2.2 Supported Providers</p>
                                <p className="text-justify mb-2">The following providers are supported:</p>
                                <ul className="list-disc pl-6 space-y-1">
                                    <li>OpenRouter (provides access to all major models)</li>
                                    <li>Poe API (access to Claude, Gemini, GPT-5.2)</li>
                                    <li>Anthropic (Claude 4/4.5 direct)</li>
                                    <li>Google Gemini (Gemini 3 direct)</li>
                                    <li>OpenAI (GPT-5, GPT-5.2)</li>
                                    <li>xAI Grok (direct)</li>
                                    <li>Ollama (local deployment)</li>
                                </ul>
                            </div>

                            <p className="text-justify mt-4 pl-6 italic text-sm border-l-4 border-slate-300">
                                <strong>Note:</strong> Expected cost per document: $0.50–$5.00 USD depending on model selection
                                and document length. OpenRouter with efficient models typically costs ~$0.50 per paper.
                            </p>
                        </div>
                    </section>

                    {/* Section 3 */}
                    <section id="upload" className="scroll-mt-20">
                        <h2 className="text-2xl font-bold mb-6 pb-2 border-b-2 border-slate-800">
                            3. Document Upload and Settings
                        </h2>

                        <div className="space-y-4">
                            <div className="pl-6">
                                <p className="font-semibold mb-2">3.1 Supported Formats</p>
                                <ul className="list-disc pl-6 space-y-1">
                                    <li><code className="px-1 bg-slate-100 font-mono text-sm">.txt</code> – Plain text (recommended)</li>
                                    <li><code className="px-1 bg-slate-100 font-mono text-sm">.pdf</code> – Portable Document Format (text extraction performed)</li>
                                    <li><code className="px-1 bg-slate-100 font-mono text-sm">.md</code> – Markdown (converted to LaTeX)</li>
                                </ul>
                            </div>

                            <div className="pl-6">
                                <p className="font-semibold mb-2">3.2 Paper Type</p>
                                <ul className="list-disc pl-6 space-y-1">
                                    <li><strong>Research Paper:</strong> Standard academic format with methodology and results sections</li>
                                    <li><strong>Essay:</strong> Argument-driven format without formal empirical methodology</li>
                                    <li><strong>Thesis:</strong> Extended multi-chapter format</li>
                                </ul>
                            </div>

                            <div className="pl-6">
                                <p className="font-semibold mb-2">3.3 Enhancement Level</p>
                                <ul className="list-disc pl-6 space-y-1">
                                    <li><strong>Minimal:</strong> Basic LaTeX formatting only</li>
                                    <li><strong>Standard:</strong> Balanced enhancement (recommended)</li>
                                    <li><strong>Advanced:</strong> Maximum scholarly elements (diagrams, algorithms, theorems)</li>
                                </ul>
                            </div>

                            <div className="pl-6">
                                <p className="font-semibold mb-2">3.4 Advanced Options</p>
                                <p className="text-justify mb-2">
                                    The following enhancements are automatically determined by the AI based on content analysis:
                                </p>
                                <p className="pl-6 text-sm mb-2">
                                    Formulas, Hypotheses, Diagrams (TikZ), Logical Structures, Symbol Definitions, Tables, Theorems, Proofs, Algorithms
                                </p>
                                <p className="text-justify text-sm italic border-l-4 border-slate-300 pl-4">
                                    <strong>Note:</strong> These options are visible but disabled in the UI. The AI decides which enhancements to apply based on your content and enhancement level setting.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Section 4 */}
                    <section id="pipeline" className="scroll-mt-20">
                        <h2 className="text-2xl font-bold mb-6 pb-2 border-b-2 border-slate-800">
                            4. Processing Pipeline
                        </h2>

                        <div className="space-y-4">
                            <p className="text-justify">
                                The system processes documents through six sequential phases. Total processing time: approximately 10–18 minutes.
                            </p>

                            <div className="pl-6 space-y-3">
                                {[
                                    {
                                        num: "4.1",
                                        title: "Phase 1: Strategist",
                                        desc: "Analyzes input document and generates execution strategy including section structure and research queries.",
                                        time: "~1 minute"
                                    },
                                    {
                                        num: "4.2",
                                        title: "Phase 2: Librarian",
                                        desc: "Conducts online research to identify supporting academic papers and citations.",
                                        time: "~2–3 minutes"
                                    },
                                    {
                                        num: "4.3",
                                        title: "Phase 3: Thinker",
                                        desc: "Generates section content in academic style with LaTeX formatting and mathematical notation.",
                                        time: "~3–5 minutes"
                                    },
                                    {
                                        num: "4.4",
                                        title: "Phase 4: Critic",
                                        desc: "Performs peer review analysis to identify logical gaps and unsupported claims.",
                                        time: "~2–3 minutes"
                                    },
                                    {
                                        num: "4.5",
                                        title: "Phase 5: Rewriter",
                                        desc: "Applies reviewer feedback and verifies citation placement.",
                                        time: "~2–3 minutes"
                                    },
                                    {
                                        num: "4.6",
                                        title: "Phase 6: Editor",
                                        desc: "Generates bibliography and validates LaTeX syntax.",
                                        time: "~1 minute"
                                    }
                                ].map((phase) => (
                                    <div key={phase.num}>
                                        <p className="font-semibold">{phase.num} {phase.title}</p>
                                        <p className="text-justify pl-6">{phase.desc} <em>({phase.time})</em></p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* Section 5 */}
                    <section id="preview" className="scroll-mt-20">
                        <h2 className="text-2xl font-bold mb-6 pb-2 border-b-2 border-slate-800">
                            5. Preview and Export
                        </h2>

                        <div className="space-y-4">
                            <div className="pl-6">
                                <p className="font-semibold mb-2">5.1 Browser Preview</p>
                                <p className="text-justify mb-2">
                                    The system renders a browser-based preview using custom parsers for mathematics (KaTeX),
                                    TikZ diagrams (TikZJax), and standard LaTeX elements. Preview accuracy: approximately 75–85%
                                    for typical academic papers.
                                </p>

                                <p className="text-justify mb-2 italic text-sm border-l-4 border-slate-300 pl-4">
                                    <strong>Limitation:</strong> Cross-references (<code className="px-1 bg-slate-100 font-mono text-sm">\ref</code>)
                                    and custom commands (<code className="px-1 bg-slate-100 font-mono text-sm">\newcommand</code>) are not supported in preview.
                                    Use local compilation for complete accuracy.
                                </p>
                            </div>

                            <div className="pl-6">
                                <p className="font-semibold mb-2">5.2 LaTeX Export</p>
                                <p className="text-justify mb-2">
                                    Click <em>Download LaTeX</em> to obtain a <code className="px-1 bg-slate-100 font-mono text-sm">.tex</code> file.
                                    The file is compile-ready with automatic sanitization applied (algorithm command normalization,
                                    BOM prevention, special character escaping).
                                </p>

                                <p className="font-semibold mb-1 mt-3">Compilation Procedure:</p>
                                <pre className="bg-slate-100 p-3 border border-slate-300 font-mono text-sm overflow-x-auto">
                                    {`pdflatex paper.tex
bibtex paper
pdflatex paper.tex
pdflatex paper.tex`}
                                </pre>
                                <p className="text-sm italic mt-1">Requires: TeX Live, MiKTeX, or MacTeX distribution</p>
                            </div>
                        </div>
                    </section>

                    {/* Section 6 */}
                    <section id="troubleshooting" className="scroll-mt-20">
                        <h2 className="text-2xl font-bold mb-6 pb-2 border-b-2 border-slate-800">
                            6. Troubleshooting
                        </h2>

                        <div className="space-y-4">
                            <p className="text-justify">
                                Common errors and their resolutions are documented below.
                            </p>

                            <div className="pl-6 space-y-4">
                                {[
                                    {
                                        issue: "\"AI response was not valid JSON\"",
                                        solution: "Verify API key in Settings. Check provider account for sufficient credits. Review detailed error message for specific failure reason."
                                    },
                                    {
                                        issue: "Processing timeout or stuck phase",
                                        solution: "Wait 2 minutes, then refresh page. Verify provider API status. Consider switching to alternative provider."
                                    },
                                    {
                                        issue: "Preview rendering errors",
                                        solution: "This is expected for complex documents. Preview accuracy is 75–85%. Export .tex file and compile locally for full quality."
                                    },
                                    {
                                        issue: "LaTeX compilation errors",
                                        solution: "Ensure complete TeX distribution is installed. Re-export file (fixes applied automatically). Verify package availability."
                                    }
                                ].map((item, idx) => (
                                    <div key={idx} className="border-l-4 border-slate-400 pl-4">
                                        <p className="font-semibold mb-1">Problem: {item.issue}</p>
                                        <p className="text-justify text-sm"><em>Solution:</em> {item.solution}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* Section 7 */}
                    <section id="latex" className="scroll-mt-20">
                        <h2 className="text-2xl font-bold mb-6 pb-2 border-b-2 border-slate-800">
                            7. LaTeX Compatibility Reference
                        </h2>

                        <div className="space-y-4">
                            <p className="text-justify">
                                The preview system supports a subset of LaTeX functionality. This section enumerates
                                supported and unsupported features.
                            </p>

                            <div className="pl-6">
                                <p className="font-semibold mb-2">7.1 Supported Features</p>
                                <ul className="list-disc pl-6 space-y-1">
                                    <li>Mathematics (inline and display, all standard environments)</li>
                                    <li>TikZ diagrams (full support via WebAssembly engine)</li>
                                    <li>Tables (including <code className="px-1 bg-slate-100 font-mono text-sm">multicolumn</code> and <code className="px-1 bg-slate-100 font-mono text-sm">multirow</code>)</li>
                                    <li>Citations and bibliography (IEEE style)</li>
                                    <li>Code blocks and algorithms</li>
                                    <li>Lists, sections, and standard formatting commands</li>
                                </ul>
                            </div>

                            <div className="pl-6">
                                <p className="font-semibold mb-2">7.2 Unsupported Features</p>
                                <ul className="list-disc pl-6 space-y-1">
                                    <li>Custom command definitions (<code className="px-1 bg-slate-100 font-mono text-sm">\newcommand</code>)</li>
                                    <li>Cross-references (<code className="px-1 bg-slate-100 font-mono text-sm">\ref</code>, <code className="px-1 bg-slate-100 font-mono text-sm">\label</code>)</li>
                                    <li>Specialized packages (availability varies)</li>
                                    <li>Multi-file documents (<code className="px-1 bg-slate-100 font-mono text-sm">\input</code>, <code className="px-1 bg-slate-100 font-mono text-sm">\include</code>)</li>
                                    <li>Custom document classes</li>
                                    <li>Float positioning directives</li>
                                </ul>
                            </div>

                            <div className="pl-6">
                                <p className="font-semibold mb-2">7.3 Accuracy Estimates</p>
                                <p className="text-justify mb-2">
                                    For a typical academic paper (e.g., arXiv submission):
                                </p>
                                <ul className="list-disc pl-6 space-y-1">
                                    <li>Content comprehension: ~90%</li>
                                    <li>Visual fidelity: ~75–85%</li>
                                    <li>Pixel-perfect accuracy: ~50%</li>
                                </ul>
                                <p className="text-justify mt-2 italic text-sm">
                                    The preview is suitable for content review. Local compilation is required for publication-quality output.
                                </p>
                            </div>

                            <div className="pl-6">
                                <p className="font-semibold mb-2">7.4 External LaTeX Files</p>
                                <p className="text-justify">
                                    External <code className="px-1 bg-slate-100 font-mono text-sm">.tex</code> files may be previewed
                                    if they use standard packages and avoid custom commands. Compatibility decreases with document complexity.
                                </p>
                            </div>
                        </div>
                    </section>
                </div>

                {/* Footer */}
                <div className="mt-16 pt-8 border-t border-slate-200 text-center text-sm text-slate-600">
                    <p className="font-medium">Auto Academic Paper • Version 1.9 • 2025</p>
                    <Link href="/">
                        <Button variant="ghost" size="sm" className="mt-4 font-medium">
                            Return to Home
                        </Button>
                    </Link>
                </div>
            </main>
        </div>
    );
}
