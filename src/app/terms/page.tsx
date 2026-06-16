import type { Metadata } from "next"
import { LegalPage, LegalSection } from "@/components/legal-page"

export const metadata: Metadata = {
  title: "Terms of Service · EchoLingo",
  description: "EchoLingo Terms of Service",
}

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="June 16, 2026">
      <p>
        Welcome to EchoLingo (the &quot;Service&quot;). The Service is a tool for learning English with
        the help of YouTube videos, providing synchronized subtitles, AI-assisted translations and
        word definitions, and the ability to save vocabulary and notes. Please read these terms
        carefully before using the Service. By accessing or using the Service, you acknowledge that
        you have read, understood, and agree to be bound by these terms.
      </p>

      <LegalSection heading="1. Description of the Service">
        <p>
          The Service lets you enter a YouTube video link and, while watching, view synchronized
          subtitles, AI-generated translations and word definitions, and save study notes. The
          Service is provided on an &quot;as-is&quot; basis. We may add, modify, or discontinue features at
          any time without individually notifying you.
        </p>
      </LegalSection>

      <LegalSection heading="2. Accounts and Sign-In">
        <p>
          You may sign in using an email magic link or a Google account. You are responsible for
          keeping your login email and account secure, and for all activity that occurs under your
          account. If you discover any unauthorized use, please contact us immediately.
        </p>
      </LegalSection>

      <LegalSection heading="3. Acceptable Use">
        <p>When using the Service, you agree that you will not:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            use the Service for any unlawful or infringing purpose, or in violation of the terms of
            any third-party platform (including YouTube);
          </li>
          <li>
            attempt to disrupt, interfere with, or gain unauthorized access to the Service or its
            related systems or data;
          </li>
          <li>
            abuse, scrape, or place an undue load on the Service through automated means beyond
            normal use;
          </li>
          <li>
            use the Service to infringe others&apos; intellectual property or to distribute unlawful or
            harmful content.
          </li>
        </ul>
        <p>
          We reserve the right to suspend or terminate your access if you violate these terms.
        </p>
      </LegalSection>

      <LegalSection heading="4. Third-Party Content">
        <p>
          The videos and subtitles shown in the Service come from third-party platforms such as
          YouTube, and the copyright in such content belongs to its respective rights holders. We
          are not responsible for the accuracy, legality, or availability of that content. Your use
          of third-party content is subject to the terms of the relevant platform. The Service is
          not affiliated with, or endorsed by, YouTube or Google.
        </p>
      </LegalSection>

      <LegalSection heading="5. AI-Generated Content">
        <p>
          Translations, definitions, and notes in the Service are generated automatically by
          third-party AI models and may contain errors, omissions, or inaccuracies. They are
          provided for learning reference only and do not constitute professional, authoritative, or
          formal advice. You should exercise your own judgment and verify the content.
        </p>
      </LegalSection>

      <LegalSection heading="6. User Content">
        <p>
          The vocabulary, notes, and other content you create in the Service (&quot;User Content&quot;) belong
          to you. To provide and improve the Service, you grant us the license necessary to store,
          process, and display this content. You are responsible for the content you create and for
          ensuring it does not infringe the rights of others.
        </p>
      </LegalSection>

      <LegalSection heading="7. Intellectual Property">
        <p>
          Except for User Content and third-party content, the intellectual property rights in the
          Service itself — including its software, interface, trademarks, and related materials —
          belong to us or our respective licensors. You may not copy, modify, distribute, or
          otherwise exploit this content without written permission.
        </p>
      </LegalSection>

      <LegalSection heading="8. Disclaimer">
        <p>
          The Service is provided on an &quot;as-is&quot; and &quot;as-available&quot; basis. We make no warranties,
          express or implied, including as to merchantability, fitness for a particular purpose, or
          uninterrupted or error-free operation. You understand and agree that you use the Service at
          your own risk.
        </p>
      </LegalSection>

      <LegalSection heading="9. Limitation of Liability">
        <p>
          To the maximum extent permitted by applicable law, we shall not be liable for any
          indirect, incidental, special, or consequential damages arising from your use of, or
          inability to use, the Service.
        </p>
      </LegalSection>

      <LegalSection heading="10. Changes and Termination">
        <p>
          We may modify, suspend, or discontinue all or part of the Service at any time. You may also
          stop using the Service and delete your account at any time.
        </p>
      </LegalSection>

      <LegalSection heading="11. Changes to These Terms">
        <p>
          We may update these terms from time to time. Updated terms take effect once posted on this
          page. If you continue to use the Service after an update, you are deemed to accept the
          revised terms.
        </p>
      </LegalSection>

      <LegalSection heading="12. Contact Us">
        <p>
          If you have any questions about these terms, please contact us at{" "}
          <a className="text-stone-500 underline underline-offset-2 hover:text-stone-700" href="mailto:martta.xu@outlook.com">
            martta.xu@outlook.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  )
}
