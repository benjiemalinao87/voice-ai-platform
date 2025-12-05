import { useState, useEffect, useRef } from 'react';
import {
    Bot, Phone, Zap, Brain, BarChart3, Users, ArrowRight,
    Check, Play, ChevronRight, Sparkles,
    MessageSquare, Target, Star, PhoneCall
} from 'lucide-react';

export function LandingPage() {
    const [isVisible, setIsVisible] = useState<Record<string, boolean>>({});
    const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

    // Animated counter hook
    const useCounter = (end: number, duration: number = 2000, shouldStart: boolean = true) => {
        const [count, setCount] = useState(0);
        useEffect(() => {
            if (!shouldStart) return;
            let startTime: number;
            const step = (timestamp: number) => {
                if (!startTime) startTime = timestamp;
                const progress = Math.min((timestamp - startTime) / duration, 1);
                setCount(Math.floor(progress * end));
                if (progress < 1) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
        }, [end, duration, shouldStart]);
        return count;
    };

    // Intersection observer for scroll animations
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        setIsVisible((prev) => ({ ...prev, [entry.target.id]: true }));
                    }
                });
            },
            { threshold: 0.1 }
        );

        Object.values(sectionRefs.current).forEach((ref) => {
            if (ref) observer.observe(ref);
        });

        return () => observer.disconnect();
    }, []);

    const navigateToRegister = () => {
        window.location.href = '/';
    };

    // Stats counters
    const callsHandled = useCounter(500000, 2500, isVisible['stats']);
    const responseTime = useCounter(3, 1500, isVisible['stats']);
    const satisfactionRate = useCounter(98, 2000, isVisible['stats']);

    return (
        <div className="min-h-screen bg-brand-dark text-white overflow-x-hidden">
            {/* Floating Orbs Background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[10%] left-[5%] w-[600px] h-[600px] rounded-full bg-brand-primary/10 blur-[150px] animate-pulse" />
                <div className="absolute top-[50%] right-[10%] w-[500px] h-[500px] rounded-full bg-brand-cyan/10 blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
                <div className="absolute bottom-[10%] left-[30%] w-[400px] h-[400px] rounded-full bg-brand-accent/10 blur-[100px] animate-pulse" style={{ animationDelay: '2s' }} />
            </div>

            {/* Navigation */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-brand-dark/80 backdrop-blur-xl border-b border-white/5">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-brand-primary to-brand-cyan rounded-xl flex items-center justify-center">
                            <Bot className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-xl font-bold">CHAU Voice AI</span>
                    </div>
                    <button
                        onClick={navigateToRegister}
                        className="px-5 py-2.5 bg-gradient-to-r from-brand-primary to-brand-accent text-white rounded-full font-semibold hover:shadow-lg hover:shadow-brand-primary/25 transition-all hover:scale-105"
                    >
                        Start Free Trial
                    </button>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative min-h-screen flex items-center pt-20">
                <div className="max-w-7xl mx-auto px-6 py-20">
                    <div className="grid lg:grid-cols-2 gap-12 items-center">

                        {/* Left: Copy */}
                        <div className="space-y-8">
                            {/* Trust Badge */}
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-sm">
                                <Sparkles className="w-4 h-4 text-brand-cyan" />
                                <span className="text-gray-300">Trusted by 500+ businesses worldwide</span>
                            </div>

                            <h1 className="text-5xl lg:text-6xl xl:text-7xl font-bold leading-tight">
                                Never Miss Another{' '}
                                <span className="bg-gradient-to-r from-brand-cyan via-brand-primary to-brand-accent bg-clip-text text-transparent">
                                    Sales Opportunity
                                </span>
                            </h1>

                            <p className="text-xl text-gray-400 leading-relaxed max-w-xl">
                                AI voice agents that qualify leads and transfer hot prospects to your team in seconds —
                                <span className="text-white font-medium"> 24/7, on autopilot</span>.
                            </p>

                            {/* CTA Buttons */}
                            <div className="flex flex-col sm:flex-row gap-4">
                                <button
                                    onClick={navigateToRegister}
                                    className="group flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-brand-primary to-brand-accent text-white rounded-2xl font-semibold text-lg hover:shadow-2xl hover:shadow-brand-primary/30 transition-all hover:scale-105"
                                >
                                    Start Free Trial
                                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </button>
                                <button className="flex items-center justify-center gap-2 px-8 py-4 bg-white/5 border border-white/10 text-white rounded-2xl font-semibold text-lg hover:bg-white/10 transition-all">
                                    <Play className="w-5 h-5" />
                                    Watch Demo
                                </button>
                            </div>

                            {/* Trust Elements */}
                            <div className="flex flex-wrap items-center gap-6 pt-4">
                                <div className="flex items-center gap-2 text-sm text-gray-400">
                                    <Check className="w-5 h-5 text-green-400" />
                                    No credit card required
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-400">
                                    <Check className="w-5 h-5 text-green-400" />
                                    Setup in 5 minutes
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-400">
                                    <Check className="w-5 h-5 text-green-400" />
                                    Cancel anytime
                                </div>
                            </div>
                        </div>

                        {/* Right: Visual */}
                        <div className="relative">
                            <div className="relative bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-8 shadow-2xl">
                                {/* Mock Dashboard Preview */}
                                <div className="space-y-6">
                                    {/* Header */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
                                            <span className="text-sm font-medium text-gray-300">Live Call Feed</span>
                                        </div>
                                        <span className="text-xs text-gray-500">Real-time</span>
                                    </div>

                                    {/* Mock Call Cards */}
                                    {[
                                        { name: 'Sarah M.', status: 'AI Qualifying...', time: '0:45', bgColor: 'bg-cyan-500/20', iconColor: 'text-cyan-400' },
                                        { name: 'John D.', status: 'Transferred to Sales!', time: '2:12', bgColor: 'bg-green-500/20', iconColor: 'text-green-400' },
                                        { name: 'Mike R.', status: 'Appointment Booked', time: '3:30', bgColor: 'bg-blue-500/20', iconColor: 'text-blue-400' },
                                    ].map((call, idx) => (
                                        <div key={idx} className="flex items-center justify-between bg-white/5 rounded-xl p-4 border border-white/5">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-full ${call.bgColor} flex items-center justify-center`}>
                                                    <PhoneCall className={`w-5 h-5 ${call.iconColor}`} />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-white">{call.name}</p>
                                                    <p className="text-sm text-gray-400">{call.status}</p>
                                                </div>
                                            </div>
                                            <span className="text-sm text-gray-500">{call.time}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Floating Badge */}
                                <div className="absolute -top-4 -right-4 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full text-sm font-semibold shadow-lg shadow-green-500/25">
                                    +47% More Conversions
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Problem / Solution Section */}
            <section className="py-24 relative">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="grid md:grid-cols-2 gap-12">
                        {/* Problem */}
                        <div className="bg-red-500/5 border border-red-500/20 rounded-3xl p-8">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-500/10 rounded-full text-red-400 text-sm font-medium mb-6">
                                <span className="w-2 h-2 rounded-full bg-red-400" />
                                The Problem
                            </div>
                            <h3 className="text-2xl font-bold mb-6 text-white">Your Sales Team Is Drowning</h3>
                            <ul className="space-y-4 text-gray-400">
                                {[
                                    'Missed calls turn into lost revenue',
                                    'Slow response times kill hot leads',
                                    'Manual call routing wastes hours daily',
                                    'No visibility into caller intent',
                                ].map((item, idx) => (
                                    <li key={idx} className="flex items-start gap-3">
                                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Solution */}
                        <div className="bg-green-500/5 border border-green-500/20 rounded-3xl p-8">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-500/10 rounded-full text-green-400 text-sm font-medium mb-6">
                                <span className="w-2 h-2 rounded-full bg-green-400" />
                                The Solution
                            </div>
                            <h3 className="text-2xl font-bold mb-6 text-white">AI That Works 24/7</h3>
                            <ul className="space-y-4 text-gray-400">
                                {[
                                    'AI answers every call instantly',
                                    'Qualifies leads in real-time',
                                    'Auto-transfers hot prospects to your team',
                                    'Full intent analysis on every conversation',
                                ].map((item, idx) => (
                                    <li key={idx} className="flex items-start gap-3">
                                        <Check className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* Stats Section */}
            <section
                id="stats"
                ref={(el) => (sectionRefs.current['stats'] = el)}
                className="py-20 border-y border-white/5"
            >
                <div className="max-w-7xl mx-auto px-6">
                    <div className="grid md:grid-cols-3 gap-8 text-center">
                        <div className="space-y-2">
                            <p className="text-5xl font-bold bg-gradient-to-r from-brand-cyan to-brand-primary bg-clip-text text-transparent">
                                {callsHandled.toLocaleString()}+
                            </p>
                            <p className="text-gray-400">Calls Handled</p>
                        </div>
                        <div className="space-y-2">
                            <p className="text-5xl font-bold bg-gradient-to-r from-brand-primary to-brand-accent bg-clip-text text-transparent">
                                {responseTime}s
                            </p>
                            <p className="text-gray-400">Average Response Time</p>
                        </div>
                        <div className="space-y-2">
                            <p className="text-5xl font-bold bg-gradient-to-r from-brand-accent to-brand-cyan bg-clip-text text-transparent">
                                {satisfactionRate}%
                            </p>
                            <p className="text-gray-400">Customer Satisfaction</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section
                id="features"
                ref={(el) => (sectionRefs.current['features'] = el)}
                className="py-24"
            >
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl lg:text-5xl font-bold mb-6">
                            Everything You Need to{' '}
                            <span className="bg-gradient-to-r from-brand-cyan to-brand-primary bg-clip-text text-transparent">
                                Close More Deals
                            </span>
                        </h2>
                        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                            A complete platform for automating your voice interactions and converting more leads.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[
                            {
                                icon: Zap,
                                title: 'Auto Warm Transfer',
                                description: 'Hot leads transferred to your sales team in seconds. Never miss a buying signal.',
                                gradient: 'from-yellow-500 to-orange-500',
                            },
                            {
                                icon: Phone,
                                title: 'Real-Time Monitoring',
                                description: 'See every call as it happens with WebSocket-powered live feeds.',
                                gradient: 'from-brand-cyan to-blue-500',
                            },
                            {
                                icon: Brain,
                                title: 'Intent Analysis',
                                description: 'AI-powered insights reveal what customers want before they say it.',
                                gradient: 'from-purple-500 to-pink-500',
                            },
                            {
                                icon: BarChart3,
                                title: 'Performance Analytics',
                                description: 'Comprehensive dashboards with conversion rates, call durations, and trends.',
                                gradient: 'from-brand-primary to-brand-accent',
                            },
                            {
                                icon: MessageSquare,
                                title: 'CRM Integration',
                                description: 'Native HubSpot and Salesforce integrations sync every interaction.',
                                gradient: 'from-green-500 to-emerald-500',
                            },
                            {
                                icon: Users,
                                title: 'Team Collaboration',
                                description: 'Invite your team, assign roles, and manage workflows together.',
                                gradient: 'from-indigo-500 to-violet-500',
                            },
                        ].map((feature, idx) => (
                            <div
                                key={idx}
                                className={`group bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all duration-300 hover:scale-[1.02] ${isVisible['features'] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                                style={{ transitionDelay: `${idx * 100}ms` }}
                            >
                                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                                    <feature.icon className="w-6 h-6 text-white" />
                                </div>
                                <h3 className="text-xl font-semibold mb-2 text-white">{feature.title}</h3>
                                <p className="text-gray-400">{feature.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How It Works Section */}
            <section className="py-24 bg-white/[0.02]">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl lg:text-5xl font-bold mb-6">
                            Get Started in{' '}
                            <span className="bg-gradient-to-r from-brand-primary to-brand-cyan bg-clip-text text-transparent">
                                3 Simple Steps
                            </span>
                        </h2>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            {
                                step: '01',
                                title: 'Create Your AI Agent',
                                description: 'Configure your AI voice agent with custom prompts, voice settings, and behavior in minutes.',
                                icon: Bot,
                            },
                            {
                                step: '02',
                                title: 'Assign Phone Numbers',
                                description: 'Get free US numbers or import from Twilio. Link them to your agents instantly.',
                                icon: Phone,
                            },
                            {
                                step: '03',
                                title: 'Start Converting',
                                description: 'Watch your AI qualify leads and transfer hot prospects to your team automatically.',
                                icon: Target,
                            },
                        ].map((item, idx) => (
                            <div key={idx} className="relative">
                                {idx < 2 && (
                                    <div className="hidden md:block absolute top-12 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-brand-primary/50 to-transparent" />
                                )}
                                <div className="text-center">
                                    <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br from-brand-primary/20 to-brand-cyan/20 border border-white/10 mb-6">
                                        <item.icon className="w-10 h-10 text-brand-cyan" />
                                    </div>
                                    <div className="text-sm font-bold text-brand-cyan mb-2">STEP {item.step}</div>
                                    <h3 className="text-xl font-bold mb-3 text-white">{item.title}</h3>
                                    <p className="text-gray-400">{item.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Testimonials Section */}
            <section className="py-24">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl lg:text-5xl font-bold mb-6">
                            Loved by{' '}
                            <span className="bg-gradient-to-r from-brand-cyan to-brand-primary bg-clip-text text-transparent">
                                Sales Teams
                            </span>
                        </h2>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6">
                        {[
                            {
                                quote: "Our lead response time went from 30 minutes to 3 seconds. Game changer for our sales team.",
                                name: "Sarah Mitchell",
                                role: "VP of Sales, TechCorp",
                                avatar: "SM",
                            },
                            {
                                quote: "The auto warm transfer feature alone has increased our close rate by 40%. It's like having a 24/7 sales assistant.",
                                name: "David Chen",
                                role: "CEO, GrowthStack",
                                avatar: "DC",
                            },
                            {
                                quote: "Finally, a platform that actually delivers on AI promises. The intent analysis is incredibly accurate.",
                                name: "Jessica Wong",
                                role: "Sales Director, ScaleUp",
                                avatar: "JW",
                            },
                        ].map((testimonial, idx) => (
                            <div key={idx} className="bg-white/5 border border-white/10 rounded-2xl p-6">
                                <div className="flex gap-1 mb-4">
                                    {[...Array(5)].map((_, i) => (
                                        <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                                    ))}
                                </div>
                                <p className="text-gray-300 mb-6 leading-relaxed">"{testimonial.quote}"</p>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-primary to-brand-cyan flex items-center justify-center text-sm font-bold">
                                        {testimonial.avatar}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-white">{testimonial.name}</p>
                                        <p className="text-sm text-gray-500">{testimonial.role}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Pricing / CTA Section */}
            <section className="py-24 bg-gradient-to-b from-transparent via-brand-primary/5 to-transparent">
                <div className="max-w-4xl mx-auto px-6 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-full text-green-400 text-sm font-medium mb-8">
                        <Sparkles className="w-4 h-4" />
                        Limited Time: Extended Free Trial
                    </div>

                    <h2 className="text-4xl lg:text-5xl font-bold mb-6">
                        Ready to{' '}
                        <span className="bg-gradient-to-r from-brand-cyan to-brand-primary bg-clip-text text-transparent">
                            Transform Your Sales?
                        </span>
                    </h2>

                    <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
                        Join 500+ businesses already using CHAU Voice AI to close more deals and never miss another opportunity.
                    </p>

                    {/* Pricing Card */}
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-8 md:p-10 max-w-lg mx-auto backdrop-blur-xl">
                        <div className="mb-6">
                            <span className="text-sm text-gray-400 uppercase tracking-wide">Free Trial</span>
                            <div className="flex items-baseline justify-center gap-2 mt-2">
                                <span className="text-5xl font-bold text-white">$0</span>
                                <span className="text-gray-400">/ 14 days</span>
                            </div>
                        </div>

                        <ul className="space-y-3 text-left mb-8">
                            {[
                                'Unlimited AI voice agents',
                                'Auto warm transfer enabled',
                                'Real-time call monitoring',
                                'CRM integrations included',
                                'Full analytics dashboard',
                                'Priority support',
                            ].map((feature, idx) => (
                                <li key={idx} className="flex items-center gap-3 text-gray-300">
                                    <Check className="w-5 h-5 text-green-400 shrink-0" />
                                    {feature}
                                </li>
                            ))}
                        </ul>

                        <button
                            onClick={navigateToRegister}
                            className="w-full flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-brand-primary to-brand-accent text-white rounded-2xl font-semibold text-lg hover:shadow-2xl hover:shadow-brand-primary/30 transition-all hover:scale-105"
                        >
                            Start Your Free Trial
                            <ArrowRight className="w-5 h-5" />
                        </button>

                        <p className="text-sm text-gray-500 mt-4">
                            No credit card required • Setup in 5 minutes
                        </p>
                    </div>
                </div>
            </section>

            {/* Final CTA Section */}
            <section className="py-24">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="relative bg-gradient-to-r from-brand-primary/20 via-brand-cyan/20 to-brand-accent/20 rounded-3xl p-10 md:p-16 overflow-hidden border border-white/10">
                        {/* Background Glow */}
                        <div className="absolute inset-0 bg-gradient-to-r from-brand-primary/10 to-brand-cyan/10 blur-3xl" />

                        <div className="relative z-10 text-center">
                            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
                                Stop Losing Leads to Slow Response Times
                            </h2>
                            <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
                                Every minute without AI-powered voice automation is revenue walking out the door.
                            </p>
                            <button
                                onClick={navigateToRegister}
                                className="group inline-flex items-center gap-2 px-10 py-5 bg-white text-brand-dark rounded-2xl font-bold text-lg hover:shadow-2xl hover:shadow-white/20 transition-all hover:scale-105"
                            >
                                Get Started Now — It's Free
                                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 border-t border-white/5">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-brand-primary to-brand-cyan rounded-lg flex items-center justify-center">
                                <Bot className="w-4 h-4 text-white" />
                            </div>
                            <span className="font-semibold">CHAU Voice AI Engine</span>
                        </div>
                        <p className="text-sm text-gray-500">
                            © {new Date().getFullYear()} Channel Automation. All rights reserved.
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
