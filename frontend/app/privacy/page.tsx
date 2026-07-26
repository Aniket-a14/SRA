import type { Metadata } from "next";
import { LegalPage, LegalNotice } from "@/components/legal/legal-page";

export const metadata: Metadata = {
    title: "Privacy Policy",
    description:
        "What SRA collects, why, who it is shared with, how long it is kept, and how to get it out or have it deleted.",
};

/**
 * Drafted against what the code actually does, not from a template. Every claim here is
 * traceable: the sub-processor list matches the outbound calls in the backend, the
 * retention periods match reconciliationService, and the rights section describes endpoints
 * that exist (GET /auth/me/export, DELETE /auth/me).
 *
 * If the implementation changes, this page is part of the change.
 */
export default function PrivacyPage() {
    return (
        <LegalPage
            eyebrow="Legal"
            title="Privacy Policy"
            summary="What we collect, why we have it, who else sees it, how long we keep it, and what you can require us to do about it."
            lastUpdated="26 July 2026"
        >
            <LegalNotice>
                This policy was drafted by describing the system&apos;s actual behaviour and has
                not been reviewed by a lawyer. Before relying on it commercially, have
                qualified counsel review it — particularly the controller identity, the legal
                bases, and the international-transfer section, which depend on facts about
                your organisation that source code cannot tell you.
            </LegalNotice>

            <h2>Who we are</h2>
            <p>
                SRA (Smart Requirements Analyzer) turns stakeholder text into structured
                requirements specifications. For the personal data described here, the
                operator of this deployment is the data controller.{" "}
                <strong>
                    The controller&apos;s legal name, registered address and contact address
                    must be filled in before this page is published.
                </strong>{" "}
                Under GDPR those details are mandatory, and no one but the operator can
                supply them.
            </p>

            <h2>What we collect</h2>

            <h3>Information you give us</h3>
            <ul>
                <li>
                    <strong>Account details</strong> — your email address, and your name and
                    profile picture if you sign in with Google or GitHub. Passwords are
                    stored only as a bcrypt hash; we never hold the password itself.
                </li>
                <li>
                    <strong>Your content</strong> — the stakeholder text you submit, the
                    specifications generated from it, your project and version history, and
                    your messages in the refinement chat.
                </li>
                <li>
                    <strong>Provider API keys</strong> — the LLM provider keys you add in
                    Settings, encrypted at rest with AES-256-GCM. We show you only a masked
                    form, and they are never returned to your browser or included in a data
                    export.
                </li>
            </ul>

            <h3>Information collected automatically</h3>
            <ul>
                <li>
                    <strong>Session and security data</strong> — IP address, browser user
                    agent, and an approximate city-level location derived from that IP, shown
                    to you on the Sessions screen so you can recognise a device you do not
                    know.
                </li>
                <li>
                    <strong>Audit records</strong> — sign-ins, sign-in failures, and
                    sensitive actions such as creating or deleting a project, with the IP and
                    user agent that performed them.
                </li>
                <li>
                    <strong>Usage analytics</strong> — aggregate page analytics via Vercel
                    Analytics, which is cookieless and does not build a cross-site profile of
                    you.
                </li>
            </ul>

            <h2>Why we have it, and on what legal basis</h2>
            <table>
                <thead>
                    <tr>
                        <th>Purpose</th>
                        <th>Data</th>
                        <th>Basis (GDPR Art. 6)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Providing the service you signed up for</td>
                        <td>Account details, your content, provider keys</td>
                        <td>Contract (6(1)(b))</td>
                    </tr>
                    <tr>
                        <td>Keeping accounts secure; investigating abuse</td>
                        <td>IP, user agent, session and audit records</td>
                        <td>Legitimate interests (6(1)(f))</td>
                    </tr>
                    <tr>
                        <td>Understanding aggregate usage</td>
                        <td>Cookieless page analytics</td>
                        <td>Legitimate interests (6(1)(f))</td>
                    </tr>
                </tbody>
            </table>

            <h2>Who else sees it</h2>
            <p>
                We do not sell personal data, and we do not share it for advertising. We use
                these processors to run the service:
            </p>
            <table>
                <thead>
                    <tr>
                        <th>Processor</th>
                        <th>What it receives</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Your chosen LLM provider (Google, OpenAI, Anthropic or xAI)</td>
                        <td>
                            The text you submit for analysis, sent under <em>your own</em> API
                            key. Their terms govern that processing — including whether they
                            retain or train on it. See the note below.
                        </td>
                    </tr>
                    <tr>
                        <td>Google (Gemini embeddings)</td>
                        <td>
                            Text converted into vectors for semantic search, under the
                            platform&apos;s key. This is the one model call not made with your key.
                        </td>
                    </tr>
                    <tr>
                        <td>Supabase (PostgreSQL)</td>
                        <td>All stored data</td>
                    </tr>
                    <tr>
                        <td>Vercel</td>
                        <td>Application hosting and cookieless analytics</td>
                    </tr>
                    <tr>
                        <td>Upstash (QStash, Redis)</td>
                        <td>Background job payloads and rate-limit counters</td>
                    </tr>
                    <tr>
                        <td>ip-api.com</td>
                        <td>Your IP address, to derive the approximate sign-in location</td>
                    </tr>
                    <tr>
                        <td>Google / GitHub</td>
                        <td>OAuth sign-in, if you choose it</td>
                    </tr>
                </tbody>
            </table>

            <h3>A note about what you submit for analysis</h3>
            <p>
                Text you analyse is sent to the model provider you selected. Before it
                leaves, we redact patterns that look like email addresses, phone numbers,
                payment card numbers and IP addresses. That redaction is a safety net working
                on patterns, <strong>not a guarantee</strong> — it cannot recognise a person&apos;s
                name, an address, a medical detail or an internal identifier. Treat anything
                you paste in as something that will reach your model provider, and do not
                submit personal data about other people unless you are entitled to.
            </p>

            <h2>Your content stays yours</h2>
            <p>
                Requirements you finalise are indexed so the system can reuse your earlier
                work when drafting something new. <strong>That index is scoped to your own
                account.</strong> Your requirements are never retrieved into, suggested to,
                or used to generate a document for another user, and they are not used to
                train any model.
            </p>

            <h2>How long we keep it</h2>
            <ul>
                <li>
                    <strong>Your account and content</strong> — until you delete them. Deleting
                    an analysis or project removes it.
                </li>
                <li>
                    <strong>Sessions</strong> — up to 7 days, and immediately when you sign out
                    or revoke the device.
                </li>
                <li>
                    <strong>Audit records</strong> — 90 days, then deleted automatically.
                </li>
                <li>
                    <strong>Deleted accounts</strong> — 30 days, then permanently erased. See
                    below.
                </li>
            </ul>

            <h2>Your rights</h2>
            <p>
                If you are in the UK, EU or EEA you have rights under the UK GDPR / GDPR; if
                you are in California you have comparable rights under the CCPA. You can
                exercise the main ones yourself, immediately, without asking us:
            </p>
            <ul>
                <li>
                    <strong>Access and portability</strong> — download everything we hold about
                    you as JSON from Settings, or via{" "}
                    <code>GET /auth/me/export</code>. Credentials are described but never
                    included, so the file cannot be used to take over your account.
                </li>
                <li>
                    <strong>Erasure</strong> — delete your account from Settings. Your sessions
                    end at once and the account stops working immediately. The data itself is
                    permanently erased after 30 days, during which you can restore the account
                    by signing in again. After that it is gone and cannot be recovered.
                </li>
                <li>
                    <strong>Rectification</strong> — edit your content and profile in the app at
                    any time.
                </li>
                <li>
                    <strong>Objection and restriction</strong> — contact us at the address above.
                </li>
            </ul>
            <p>
                You also have the right to complain to a supervisory authority — in the UK,
                the Information Commissioner&apos;s Office.
            </p>

            <h2>Cookies</h2>
            <p>
                We use two cookies, both strictly necessary, and no advertising or tracking
                cookies at all:
            </p>
            <ul>
                <li>
                    <strong>refreshToken</strong> — keeps you signed in. HttpOnly, Secure, and
                    unreadable by JavaScript. Lasts up to 7 days.
                </li>
                <li>
                    <strong>oauth_state</strong> — protects the OAuth sign-in flow against
                    request forgery. Lasts 10 minutes.
                </li>
            </ul>
            <p>
                Because both are strictly necessary to deliver a service you asked for, and
                our analytics sets no cookies, we do not show a consent banner. If tracking or
                advertising cookies are ever added, consent must be obtained first and this
                section rewritten.
            </p>

            <h2>Security</h2>
            <p>
                Passwords are hashed with bcrypt and provider keys are encrypted with
                AES-256-GCM. Session tokens are stored only as hashes, so a copy of our
                database does not yield usable sessions. Traffic is served over HTTPS with
                HSTS. Access to your projects, analyses and reuse index is restricted to your
                own account and enforced in every database query.
            </p>
            <p>
                No system is perfectly secure. If you believe you have found a vulnerability,
                please report it to the contact address above rather than disclosing it
                publicly.
            </p>

            <h2>International transfers</h2>
            <p>
                Our processors operate globally, so your data may be processed outside your
                country, including in the United States.{" "}
                <strong>
                    The specific transfer mechanism relied on must be confirmed with counsel
                    and stated here before publication.
                </strong>
            </p>

            <h2>Children</h2>
            <p>
                This service is not intended for children under 16, and we do not knowingly
                collect their personal data.
            </p>

            <h2>Changes</h2>
            <p>
                If we change this policy we will update the date at the top, and for material
                changes we will tell you in the app before they take effect.
            </p>
        </LegalPage>
    );
}
