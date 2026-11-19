// OURS: our terms of service, for business customers in the UK. Covers what
// LinkedIn's API Terms (section 5.1 and 8.1) and Meta's Platform Terms expect
// an app's own user terms to say. Sources are listed in SOURCES.md (this folder).
import { FC } from 'react';
import { brand } from '@gitroom/frontend/ours/brand/brand';
import { LegalFacts, legalPaths } from '@gitroom/frontend/ours/legal/legal';
import {
  Email,
  Fact,
  LegalPage,
  List,
  Section,
} from '@gitroom/frontend/ours/legal/legal.page';

export const TermsOfService: FC<{ facts: LegalFacts }> = ({ facts }) => {
  const name = brand.name;
  const email = <Email address={facts.contactEmail} />;
  const link = (href: string, text: string) => (
    <a href={href} className="text-btnPrimary underline underline-offset-2">
      {text}
    </a>
  );
  return (
    <LegalPage title="Terms of service" current={legalPaths.terms} facts={facts}>
      <p>
        These terms are an agreement between your business and{' '}
        {facts.companyName} (company number{' '}
        <Fact value={facts.companyNumber} label="company number" />,
        registered office{' '}
        <Fact value={facts.registeredAddress} label="registered office address" />
        ), which provides {name}. In these terms, &quot;we&quot; and
        &quot;us&quot; means {facts.companyName}, and &quot;you&quot; means
        the business that uses {name}. By creating an account you agree to
        them, so please read them.
      </p>

      <Section id="service" title="1. The service">
        <p>
          {name} reads your business&apos;s public website, builds a business
          profile from it, drafts social media posts from that profile, and
          publishes the posts you approve to the Facebook, Instagram and
          LinkedIn accounts you connect, at the times you choose.
        </p>
        <p>
          Any test or sandbox channel in {name} is labelled as such. Posts to a
          sandbox channel are recorded in {name} only and are never sent to a
          real platform.
        </p>
      </Section>

      <Section id="who" title="2. Who can use it">
        <List>
          <li>
            {name} is for businesses. You must be at least 18 and have the
            authority to accept these terms for the business you represent.
          </li>
          <li>
            You must give accurate details when you sign up and keep your
            password safe. You are responsible for what happens in your
            account, including what the team members you invite do.
          </li>
          <li>
            Tell us straight away at {email} if you think someone has got into
            your account.
          </li>
        </List>
      </Section>

      <Section id="approval" title="3. Nothing is published without your approval">
        <List>
          <li>
            We only publish a post after you, or a team member you have
            authorised, approves it in {name}.
          </li>
          <li>
            Once you approve a post and choose a time, we publish it at that
            time. You can change or cancel it at any time before it goes out.
          </li>
          <li>
            You are responsible for the posts you approve, including whether
            they are accurate and lawful.
          </li>
        </List>
      </Section>

      <Section id="ai" title="4. AI drafts">
        <List>
          <li>
            Drafts are written with the help of AI and are labelled as such.
            We base them only on your business profile: what your website says
            and what you tell us. We do not ask the AI to invent prices,
            offers, reviews, qualifications or other claims about your
            business.
          </li>
          <li>
            AI can make mistakes. Check every draft before you approve it, and
            edit or reject anything that is wrong. You can edit any draft
            before it is published.
          </li>
          <li>
            You must not use {name} to make claims you cannot back up, to post
            fake reviews or testimonials, or to mislead people. UK advertising
            and consumer protection rules apply to your posts.
          </li>
          <li>
            Please report inaccurate, harmful or offensive AI output to{' '}
            {email}.
          </li>
        </List>
      </Section>

      <Section id="platforms" title="5. Facebook, Instagram and LinkedIn">
        <List>
          <li>
            When you connect an account, you allow {name} to publish to it and
            read the information described in our{' '}
            {link(legalPaths.privacy, 'privacy policy')}. You can disconnect
            it at any time.
          </li>
          <li>
            Your use of those platforms is also governed by their own terms
            and policies, which you must follow.
          </li>
          <li>
            {name} is not affiliated with, endorsed by or supported by Meta or
            LinkedIn. We, not they, are responsible for supporting you with{' '}
            {name}.
          </li>
          <li>
            The platforms decide what they accept and can change or withdraw
            their services. We are not responsible for a platform rejecting,
            removing or limiting a post, or for a platform being unavailable.
          </li>
        </List>
      </Section>

      <Section id="content" title="6. Your content">
        <List>
          <li>
            You keep ownership of your content: the material you upload, the
            details you add, and the posts you approve.
          </li>
          <li>
            You give us permission to store, copy, adapt (for example resize
            an image to fit a platform) and publish your content, only as
            needed to provide {name} to you.
          </li>
          <li>
            You confirm that you have the right to use everything you upload
            or approve, including other people&apos;s photos, names and words,
            and that the website you ask us to read is your business&apos;s
            own.
          </li>
        </List>
      </Section>

      <Section id="acceptable-use" title="7. Acceptable use">
        <p>You must not use {name} to:</p>
        <List>
          <li>post anything unlawful, defamatory, hateful or harassing;</li>
          <li>infringe anyone&apos;s copyright, trade marks or privacy;</li>
          <li>send spam, or post on accounts you are not authorised to manage;</li>
          <li>
            try to get around our security, overload the service, or access
            other customers&apos; data;
          </li>
          <li>read websites you have no right to ask us to read.</li>
        </List>
        <p>
          The software behind {name} is open source, published under the GNU
          Affero General Public License version 3. Nothing in these terms
          limits your rights under that licence. The{' '}
          {link(brand.sourceCodeUrl, 'source code')} is available to every
          user.
        </p>
      </Section>

      <Section id="fees" title="8. Fees">
        <p>
          {name} is currently free to use while we test it. We will not
          charge you anything without telling you the price and getting your
          agreement first. Any payment screen you see while we test uses
          Stripe&apos;s test mode and takes no real money. Paid plans will come
          with updated terms.
        </p>
      </Section>

      <Section id="availability" title="9. Availability and changes">
        <p>
          We work to keep {name} running and secure, but we cannot promise it
          will always be available or free of errors. We may need to pause it
          for maintenance or to fix problems. We may improve or change
          features, and will tell you in advance about changes that
          significantly affect you.
        </p>
      </Section>

      <Section id="data" title="10. Personal data">
        <p>
          Our {link(legalPaths.privacy, 'privacy policy')} explains how we
          use personal data about you and your team.
        </p>
        <p>
          Where you put other people&apos;s personal data into {name}, such as
          a customer in a photo, you are the controller of that data and we
          process it for you. When we do, we will:
        </p>
        <List>
          <li>use it only to provide {name}, on your documented instructions;</li>
          <li>make sure our staff are bound to keep it confidential;</li>
          <li>keep it secure with appropriate technical and organisational measures;</li>
          <li>
            use only the providers listed in our privacy policy, under
            contracts with the same protections, and tell you before we add or
            replace one so you can object;
          </li>
          <li>
            help you respond to requests from people exercising their rights,
            and with security, breach notification and impact assessments;
          </li>
          <li>tell you without undue delay if we become aware of a breach affecting it;</li>
          <li>
            delete or return it when you close your account, unless the law
            requires us to keep it;
          </li>
          <li>
            give you the information you need to show that these obligations
            are met, and allow for reasonable audits.
          </li>
        </List>
      </Section>

      <Section id="ending" title="11. Ending the agreement">
        <List>
          <li>
            You can stop using {name} and close your account at any time by
            emailing {email}. See{' '}
            {link(legalPaths.dataDeletion, 'how to delete your data')}.
          </li>
          <li>
            We may suspend or close your account if you seriously or
            repeatedly break these terms, if a platform requires it, or if we
            must do so by law. Where we reasonably can, we will warn you first
            and give you a chance to put things right.
          </li>
          <li>
            We may stop providing {name} altogether by giving you at least 30
            days&apos; notice.
          </li>
          <li>
            When the agreement ends, scheduled posts will not be published and
            we will delete your data as our privacy policy describes. Ask us
            before then if you want a copy of your content.
          </li>
        </List>
      </Section>

      <Section id="liability" title="12. Our responsibility to you">
        <List>
          <li>
            Nothing in these terms limits our liability for death or personal
            injury caused by our negligence, for fraud, or for anything else
            the law does not allow us to limit.
          </li>
          <li>
            We are not liable for loss of profits, revenue, business, goodwill
            or data, or for any indirect or consequential loss.
          </li>
          <li>
            We are not liable for content you approve, or for what a platform
            does with a post.
          </li>
          <li>
            Otherwise, our total liability to you in any 12-month period is
            limited to the greater of the fees you paid us in that period and
            £100.
          </li>
          <li>
            You agree to cover our reasonable losses if a third party makes a
            claim against us because of content you uploaded or approved.
          </li>
        </List>
      </Section>

      <Section id="changes" title="13. Changes to these terms">
        <p>
          We may update these terms. We will give you at least 30 days&apos;
          notice by email or in the app before a significant change takes
          effect. If you do not agree, you can close your account before then.
        </p>
      </Section>

      <Section id="general" title="14. General">
        <List>
          <li>
            These terms, together with our privacy policy, are the whole
            agreement between us about {name}.
          </li>
          <li>
            We may transfer this agreement to another business that takes over{' '}
            {name}. You may not transfer it without our written agreement.
          </li>
          <li>
            Nobody else has a right to enforce these terms under the Contracts
            (Rights of Third Parties) Act 1999.
          </li>
          <li>
            If a court finds part of these terms unenforceable, the rest still
            applies.
          </li>
          <li>
            These terms are governed by the law of{' '}
            <Fact value={facts.jurisdiction} label="governing law" />, and its
            courts have exclusive jurisdiction.
          </li>
        </List>
      </Section>

      <Section id="contact" title="15. Contact us">
        <p>
          Email {email}, or write to {facts.companyName},{' '}
          <Fact value={facts.registeredAddress} label="registered office address" />
          .
        </p>
      </Section>
    </LegalPage>
  );
};
