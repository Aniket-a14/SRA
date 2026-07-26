import type { Metadata } from "next";
import { LegalPage, LegalNotice } from "@/components/legal/legal-page";

export const metadata: Metadata = {
    title: "Terms of Service",
    description:
        "The terms you accept by using SRA — what the service does, what it does not promise, and who is responsible for what.",
};

export default function TermsPage() {
    return (
        <LegalPage
            eyebrow="Legal"
            title="Terms of Service"
            summary="What you can expect from SRA, what we expect from you, and the limits on both."
            lastUpdated="26 July 2026"
        >
            <LegalNotice>
                These terms were drafted to match how the service actually works and have not
                been reviewed by a lawyer. The liability, warranty and governing-law sections
                in particular need qualified review, and their enforceability depends on your
                jurisdiction and how you operate the service.
            </LegalNotice>

            <h2>1. What this service is</h2>
            <p>
                SRA drafts software requirements specifications — IEEE 830, ISO/IEC/IEEE
                29148, Volere or an Agile PRD — from text you provide, using a pipeline of
                large-language-model agents, and traces those requirements back to source
                code through the SRA CLI.
            </p>

            <h2>2. Your account</h2>
            <ul>
                <li>You must be at least 16 and give accurate registration details.</li>
                <li>
                    You are responsible for what happens under your account, including
                    anything done with an API key you create. Keys carry real authority — treat
                    them as passwords, grant the narrowest scope that works, and revoke any
                    you no longer need.
                </li>
                <li>Tell us promptly if you believe your account has been compromised.</li>
                <li>One person or organisation per account; do not share credentials.</li>
            </ul>

            <h2>3. Bring your own model key</h2>
            <p>
                Generation runs on <em>your</em> API key for the provider you choose. That
                means:
            </p>
            <ul>
                <li>
                    You are billed directly by that provider for the tokens SRA consumes on
                    your behalf. We do not mark up, meter or resell model usage, and we cannot
                    refund it.
                </li>
                <li>
                    Your use of the model is also governed by that provider&apos;s terms and
                    acceptable-use policy, which you are responsible for complying with.
                </li>
                <li>
                    You must be entitled to use the key you supply. Do not add an employer&apos;s
                    or client&apos;s key without their authorisation.
                </li>
                <li>
                    We store your key encrypted and use it only to make calls you initiate.
                    You can delete it at any time.
                </li>
            </ul>

            <h2>4. Your content</h2>
            <p>
                You keep all rights to the text you submit and the specifications produced
                from it. You grant us only the narrow licence needed to run the service:
                storing your content, sending it to your chosen model provider, and indexing
                it so you can reuse your own earlier work.
            </p>
            <p>
                <strong>We do not train models on your content, and we do not share it with
                other users.</strong> Requirements you finalise are indexed for reuse within
                your own account only.
            </p>
            <p>
                You are responsible for having the right to submit what you submit. Do not
                submit material you are not permitted to disclose, or personal data about
                other people that you have no basis to share.
            </p>

            <h2>5. Acceptable use</h2>
            <p>Do not use SRA to:</p>
            <ul>
                <li>Break the law, or infringe anyone&apos;s rights.</li>
                <li>
                    Access another user&apos;s account or data, or probe or interfere with the
                    service&apos;s security. Good-faith vulnerability research reported privately
                    to us is welcome and is not a breach of this clause.
                </li>
                <li>
                    Circumvent rate limits or quotas, or automate the service in ways designed
                    to degrade it for others.
                </li>
                <li>Resell access to the platform without a written agreement with us.</li>
            </ul>

            <h2>6. What the output is, and is not</h2>
            <p>
                Specifications are produced by language models. They can be wrong, incomplete
                or internally inconsistent, and they can be confidently wrong. The quality
                scores, compliance checks and review passes in the pipeline are useful signals
                — they are not assurance.
            </p>
            <p>
                <strong>
                    Every generated document must be reviewed by a competent human before it is
                    relied on.
                </strong>{" "}
                Do not treat SRA output as legal, regulatory, safety or professional advice,
                and do not use it unreviewed for any safety-critical or regulated system.
            </p>

            <h2>7. Availability</h2>
            <p>
                We offer no uptime guarantee. The service depends on third parties — model
                providers, hosting, queueing — and may be unavailable, and model providers may
                rate-limit or reject your requests independently of us. We may change or
                discontinue features. Export your data if you need a durable copy; the export
                tool exists for exactly that.
            </p>

            <h2>8. Ending your use</h2>
            <p>
                You can delete your account at any time from Settings. Deletion takes effect
                immediately and the data is erased after 30 days, during which you can restore
                it by signing in. We may suspend or terminate an account that materially
                breaches these terms, and will give notice where it is reasonable to do so.
            </p>

            <h2>9. Disclaimer and liability</h2>
            <p>
                The service is provided &quot;as is&quot;, without warranties of any kind to
                the fullest extent the law allows. We are not liable for indirect or
                consequential loss, for lost profits or data, or for decisions made on the
                basis of generated output.
            </p>
            <p>
                Nothing here excludes liability that cannot lawfully be excluded — including
                for death or personal injury caused by negligence, or for fraud. If you are a
                consumer, your statutory rights are unaffected.
            </p>

            <h2>10. Changes</h2>
            <p>
                We may update these terms. Material changes will be announced in the app
                before taking effect, and the date above will change. Continuing to use the
                service after that means you accept the revised terms.
            </p>

            <h2>11. Governing law and contact</h2>
            <p>
                <strong>
                    The governing law, jurisdiction and the operator&apos;s contact address must be
                    completed before publication.
                </strong>{" "}
                See also our <a href="/privacy">Privacy Policy</a>, which forms part of these
                terms.
            </p>
        </LegalPage>
    );
}
