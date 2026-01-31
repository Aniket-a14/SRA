'use client'

import { useReportWebVitals } from 'next/web-vitals'

/**
 * Client component to monitor and report Web Vitals (LCP, FID, CLS, etc.)
 * In a real-world scenario, these would be sent to an analytics endpoint.
 */
export function VitalsMonitor() {
    useReportWebVitals((metric) => {
        // Standardize metric name and value
        const { name, value, id } = metric;

        // Log to console in development
        if (process.env.NODE_ENV === 'development') {
            console.debug(`[Web Vital] ${name}: ${Math.round(value)}ms (ID: ${id})`);
        }

        // Example: Report to analytics/logging service
        // In production, we could send this to /api/vitals or an external service
        if (process.env.NODE_ENV === 'production') {
            // navigator.sendBeacon('/api/vitals', JSON.stringify({ name, value, id, url: window.location.href }));
        }
    })

    return null
}
