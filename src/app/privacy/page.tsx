import type { Metadata } from "next"
import { LegalPage, LegalSection } from "@/components/legal-page"

export const metadata: Metadata = {
  title: "Privacy Policy · EchoLingo",
  description: "EchoLingo Privacy Policy",
}

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="June 16, 2026">
      <p>
        This Privacy Policy explains how EchoLingo (the &quot;Service&quot;) collects, uses, stores, and
        protects your personal information when you use it. We value your privacy and only process
        your information to the extent necessary to provide the Service. By using the Service, you
        agree to the practices described in this policy.
      </p>

      <LegalSection heading="1. Information We Collect">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <span className="font-medium text-stone-700">Account information</span>: when you sign in
            via an email magic link or a Google account, we collect your email address; if you sign
            in with Google, this may also include basic profile information provided by Google (such
            as name and avatar).
          </li>
          <li>
            <span className="font-medium text-stone-700">User content</span>: the vocabulary and
            notes you save in the Service, as well as the video links you have looked up and other
            study data.
          </li>
          <li>
            <span className="font-medium text-stone-700">Usage data</span>: to keep the Service
            stable and prevent abuse, we may log limited technical information, such as request
            counts and access times.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="2. How We Use Information">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            to provide, maintain, and improve the core features of the Service (subtitle sync,
            translation, definitions, note-saving, etc.);
          </li>
          <li>to verify your identity and keep you signed in;</li>
          <li>to prevent fraud and abuse and to keep the Service secure;</li>
          <li>to communicate with you about matters related to the Service when necessary.</li>
        </ul>
        <p>We do not sell your personal information.</p>
      </LegalSection>

      <LegalSection heading="3. Third-Party Services">
        <p>To provide the Service, we use the following third-party services, which may process some data:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <span className="font-medium text-stone-700">Supabase</span>: for authentication and
            data storage (including your email and User Content).
          </li>
          <li>
            <span className="font-medium text-stone-700">Google</span>: for Google account sign-in
            (OAuth).
          </li>
          <li>
            <span className="font-medium text-stone-700">YouTube</span>: for retrieving video and
            subtitle content.
          </li>
          <li>
            <span className="font-medium text-stone-700">Third-party AI providers</span>: to generate
            translations and word definitions, relevant text snippets are sent to AI model services
            for processing.
          </li>
        </ul>
        <p>
          These third-party services are each responsible for their own data practices, and we
          recommend you also review their privacy policies.
        </p>
      </LegalSection>

      <LegalSection heading="4. Note on AI Processing">
        <p>
          When you use the translation or definition features, the relevant subtitle or word text is
          sent to a third-party AI service to generate results. To reduce redundant processing and
          lower costs, some generated results may be cached. Please do not enter sensitive personal
          information you would not want processed by a third party when relying on these features.
        </p>
      </LegalSection>

      <LegalSection heading="5. Cookies and Sessions">
        <p>
          We use necessary cookies and local storage to maintain your login session. This information
          is used to identify you and keep you signed in. Unless you actively sign out or clear your
          browser data, your login state will remain active.
        </p>
      </LegalSection>

      <LegalSection heading="6. Data Storage and Security">
        <p>
          Your data is stored in the third-party infrastructure we use (such as Supabase). We take
          reasonable technical and organizational measures to protect your information, but please
          note that no method of transmission over the internet or electronic storage is completely
          secure.
        </p>
      </LegalSection>

      <LegalSection heading="7. Data Retention and Deletion">
        <p>
          We retain your information for as long as necessary to provide the Service. You may request
          deletion of your account and related data at any time; once deleted, the corresponding User
          Content will be removed from our systems (except for backups and portions we are required
          to retain by law).
        </p>
      </LegalSection>

      <LegalSection heading="8. Your Rights">
        <p>
          To the extent permitted by applicable law, you have the right to access, correct, or delete
          your personal information, or to object to certain processing activities. To exercise these
          rights, please contact us using the details below.
        </p>
      </LegalSection>

      <LegalSection heading="9. Children's Privacy">
        <p>
          The Service is not directed to children under the age of 13. We do not knowingly collect
          personal information from children. If you believe we may have collected such information,
          please contact us so we can delete it.
        </p>
      </LegalSection>

      <LegalSection heading="10. Changes to This Policy">
        <p>
          We may update this Privacy Policy from time to time. The updated policy takes effect once
          posted on this page. We recommend you review this page periodically for the latest version.
        </p>
      </LegalSection>

      <LegalSection heading="11. Contact Us">
        <p>
          If you have any questions or requests regarding this Privacy Policy, please contact us at{" "}
          <a className="text-stone-500 underline underline-offset-2 hover:text-stone-700" href="mailto:martta.xu@outlook.com">
            martta.xu@outlook.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  )
}
