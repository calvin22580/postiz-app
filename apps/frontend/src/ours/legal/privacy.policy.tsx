// OURS: our privacy policy. Written for UK GDPR and the Data Protection Act
// 2018, and for what Meta's Platform Terms (section 4) and LinkedIn's API Terms
// (section 5) ask a privacy policy to cover. Sources are listed in
// SOURCES.md (this folder). Needs a solicitor's review before launch.
import { FC } from 'react';
import { brand } from '@gitroom/frontend/ours/brand/brand';
import { LegalFacts, legalPaths } from '@gitroom/frontend/ours/legal/legal';
import {
  Email,
  Fact,
  LegalPage,
  List,
  Section,
  Table,
} from '@gitroom/frontend/ours/legal/legal.page';

export const PrivacyPolicy: FC<{ facts: LegalFacts }> = ({ facts }) => {
  const name = brand.name;
  const email = <Email address={facts.contactEmail} />;
  return (
    <LegalPage title="Privacy policy" current={legalPaths.privacy} facts={facts}>
      <p>
        This policy explains what personal data {name} collects, why, how long
        we keep it, who we share it with and the rights you have. {name} is an
        AI social media service for UK small businesses: it reads your
        business&apos;s public website, drafts posts for you, and publishes
        them to the social media accounts you connect, only after you approve
        them.
      </p>

      <div className="rounded-[10px] border border-newBorder bg-newBgColor px-[16px] py-[14px]">
        <p className="font-[600]">The short version</p>
        <List>
          <li>We only publish a post after you have approved it.</li>
          <li>
            We use your data to run the service for you. We do not sell it, and
            we do not use it to build advertising profiles.
          </li>
          <li>
            We do not use your data, or anything we receive from Facebook,
            Instagram or LinkedIn, to train AI models.
          </li>
          <li>
            You can ask us to delete your data at any time.{' '}
            <a
              href={legalPaths.dataDeletion}
              className="text-btnPrimary underline underline-offset-2"
            >
              Here is how
            </a>
            .
          </li>
        </List>
      </div>

      <Section id="who-we-are" title="1. Who we are">
        <p>
          {name} is provided by {facts.companyName}, a company registered in{' '}
          <Fact value={facts.jurisdiction} label="country of registration" />{' '}
          with company number{' '}
          <Fact value={facts.companyNumber} label="company number" />. Our
          registered office is{' '}
          <Fact value={facts.registeredAddress} label="registered office address" />
          .
        </p>
        <p>
          {facts.companyName} is the controller of the personal data described
          in this policy, except where section 9 says otherwise. We are
          registered with the Information Commissioner&apos;s Office (ICO)
          under registration number{' '}
          <Fact value={facts.icoNumber} label="ICO registration number" />.
        </p>
        <p>
          For anything about your personal data, email {email}. We have not
          appointed a Data Protection Officer, because the law does not require
          one for a business of our size and type. Questions are answered by
          the person responsible for data protection at {facts.companyName}.
        </p>
      </Section>

      <Section id="what-we-collect" title="2. What we collect">
        <p className="font-[600]">Information you give us</p>
        <List>
          <li>
            <strong>Account details:</strong> your name, email address,
            password (stored only in scrambled, hashed form), your business or
            organisation name, and the team members you invite.
          </li>
          <li>
            <strong>Preferences:</strong> your time zone, date and clock
            format, language and other settings.
          </li>
          <li>
            <strong>Your content:</strong> drafts, captions, images and other
            media you upload, your posting schedule, and your approvals, edits
            and rejections.
          </li>
          <li>
            <strong>Business details you add or correct</strong> in your
            business profile.
          </li>
          <li>
            <strong>Messages to us:</strong> what you send when you contact
            support.
          </li>
        </List>

        <p className="font-[600]">Information from your website</p>
        <p>
          When you give us your website address, we read a small number of its
          public pages (we respect the site&apos;s robots.txt) and build a
          business profile from what they say: for example what you do, where
          you are, your services, your opening hours and the contact details
          you publish. Every item in the profile is linked to the page it came
          from. If your website names people, such as staff, their names may
          appear in the text we read.
        </p>

        <p className="font-[600]">
          Information from Facebook, Instagram and LinkedIn
        </p>
        <p>
          When you connect a social media account, you sign in on that
          platform&apos;s own page and choose what to allow. We never see your
          password for those platforms. Depending on the platform and what you
          allow, we receive:
        </p>
        <List>
          <li>
            an access token that lets us post for you, and its expiry date;
          </li>
          <li>
            the name, ID and profile picture of your account and of the
            Facebook Pages, Instagram professional accounts or LinkedIn Pages
            you manage and choose to connect;
          </li>
          <li>the ID of and link to each post we publish for you;</li>
          <li>
            statistics about your posts and pages, such as reach, likes and
            comment counts, where the platform provides them and you use the
            analytics features.
          </li>
        </List>
        <p>
          Section 5 explains the limits we put on how we use this information.
        </p>

        <p className="font-[600]">Information collected automatically</p>
        <List>
          <li>
            <strong>Sign-in and security data:</strong> your IP address,
            browser type and when you were last active.
          </li>
          <li>
            <strong>Sign-up source:</strong> the page you first landed on, the
            website that referred you and any campaign tag in the link. Your
            browser stores these and sends them to us when you create an
            account.
          </li>
          <li>
            <strong>Service records:</strong> logs of errors and of the AI
            requests made for your account, including their size and cost.
          </li>
          <li>
            <strong>Cookies and similar storage:</strong> see section 11.
          </li>
        </List>

        <p className="font-[600]">Payments</p>
        <p>
          We do not take payments yet. We will update this policy before we
          do.
        </p>
      </Section>

      <Section id="how-we-use-it" title="3. How we use it, and our lawful basis">
        <p>
          UK data protection law says we must have a lawful basis for each use
          of your personal data. These are ours.
        </p>
        <Table
          head={['What we do', 'Lawful basis']}
          rows={[
            [
              'Create and run your account, and provide the features you use',
              'Contract: we need it to provide the service you signed up for',
            ],
            [
              'Read your website and build your business profile',
              'Contract, because you asked us to. For other people named on your website: our legitimate interest in describing your business accurately',
            ],
            [
              'Draft posts with AI from your business profile',
              'Contract',
            ],
            [
              'Publish the posts you approve to the accounts you connect, and show how they performed',
              'Contract',
            ],
            [
              'Send service emails, such as sign-in links, approval reminders and notices about your account',
              'Contract',
            ],
            [
              'Keep the service secure, prevent fraud and abuse, and fix errors',
              'Legitimate interests: protecting you, other customers and our service',
            ],
            [
              'Understand which marketing brought you to us, and measure AI costs per account',
              'Legitimate interests: running our business sensibly',
            ],
            [
              'Send news and offers',
              'Consent. We only do this if you opt in, and you can opt out at any time',
            ],
            [
              'Keep records the law requires, and respond to lawful requests from authorities',
              'Legal obligation',
            ],
          ]}
        />
        <p>
          Where we rely on legitimate interests, we have weighed them against
          your rights. You can object at any time (see section 10).
        </p>
      </Section>

      <Section id="ai" title="4. How we use AI">
        <List>
          <li>
            {name} uses an AI model, provided by Anthropic (see section 6), to
            read your website text and build your business profile, and to
            draft posts. Drafts written by AI are labelled as such in the app.
          </li>
          <li>
            Drafts use facts from your business profile only: things your
            website says, or things you have told us. We do not ask the AI to
            invent prices, offers, reviews or claims about your business.
          </li>
          <li>
            AI can still make mistakes. Please check every draft before you
            approve it. You can edit or reject any draft.
          </li>
          <li>
            Nothing is published until you approve it. Drafts we prepare for
            you are covered by this policy.
          </li>
          <li>
            We do not use your data to train AI models, and we do not allow our
            AI provider to do so.
          </li>
          <li>
            We do not make decisions about you by automated means that have
            legal or similarly significant effects.
          </li>
          <li>
            If you see AI output that is inaccurate, harmful or offensive,
            please report it to {email}.
          </li>
        </List>
      </Section>

      <Section
        id="platform-data"
        title="5. Data from Facebook, Instagram and LinkedIn"
      >
        <p>
          We use information we receive from Meta (Facebook and Instagram) and
          LinkedIn only to provide the features you use: publishing the posts
          you approve, showing your connected accounts, and reporting how your
          posts performed. In particular:
        </p>
        <List>
          <li>We do not sell, license or buy platform data.</li>
          <li>
            We do not use it for advertising, to build profiles of people, or
            to make decisions about anyone&apos;s eligibility for anything.
          </li>
          <li>
            We do not use it to train AI. We do not give the AI information
            about other people&apos;s accounts or posts.
          </li>
          <li>
            We show it only to you and the team members in your {name}{' '}
            account, and never pass it to other customers.
          </li>
          <li>
            We delete it when you ask us to, when you close your account, when
            we no longer need it to provide the service, or when the platform
            asks us to.
          </li>
        </List>
        <p>
          You can remove {name}&apos;s access at any time in the settings of
          your Facebook, Instagram or LinkedIn account (look for apps,
          business integrations or permitted services). This stops us acting
          for you. To have the data we already hold deleted as well, follow{' '}
          <a
            href={legalPaths.dataDeletion}
            className="text-btnPrimary underline underline-offset-2"
          >
            our data deletion instructions
          </a>
          .
        </p>
        <p>
          {name} is not affiliated with, endorsed by or supported by Meta or
          LinkedIn. Their own privacy policies cover what they do with your
          posts once they are published.
        </p>
      </Section>

      <Section id="sharing" title="6. Who we share it with">
        <p>
          We use the service providers below to run {name}. They act only on
          our instructions, under contracts that require them to protect your
          data.
        </p>
        <Table
          head={['Provider', 'What they do for us', 'Where']}
          rows={[
            [
              'Cloudflare, Inc. (Containers)',
              'Runs our application servers',
              "Cloudflare's network, in the data centre nearest the request (normally in Europe)",
            ],
            [
              'PlanetScale, Inc.',
              'Runs our database',
              'United Kingdom (London)',
            ],
            [
              'Temporal Technologies, Inc. (Temporal Cloud)',
              'Schedules publishing jobs; keeps job records for 1 day',
              'United Kingdom (London)',
            ],
            [
              'Anthropic, PBC',
              'AI model that reads website text and drafts posts',
              'United States',
            ],
            [
              'Cloudflare, Inc. (R2 storage)',
              'Stores the images and media you upload',
              'Western Europe',
            ],
          ]}
        />
        <p>
          We do not use an email delivery provider yet. We will add it to this
          list before we start sending service emails.
        </p>
        <p>We also share personal data:</p>
        <List>
          <li>
            <strong>With the social media platforms you choose,</strong> when
            we publish the posts you approve. Once published, a post is handled
            under that platform&apos;s own terms and privacy policy.
          </li>
          <li>
            <strong>With your team:</strong> people you invite to your {name}{' '}
            account can see its content and connected accounts.
          </li>
          <li>
            <strong>With professional advisers,</strong> such as lawyers and
            accountants, where needed.
          </li>
          <li>
            <strong>With authorities,</strong> such as the police, HMRC or a
            court, where the law requires it.
          </li>
          <li>
            <strong>With a buyer,</strong> if our business is sold or
            restructured. They would have to respect this policy.
          </li>
        </List>
        <p>We do not sell personal data.</p>
      </Section>

      <Section id="transfers" title="7. Transfers outside the UK">
        <p>
          Some of our providers process data outside the UK, for example in
          the United States. When they do, we make sure the transfer is
          protected by UK adequacy regulations (including the UK-US data
          bridge, where the provider has signed up to it), or by the UK
          International Data Transfer Agreement or the UK Addendum to the EU
          standard contractual clauses. Email {email} for details of the
          safeguard for a particular provider.
        </p>
      </Section>

      <Section id="retention" title="8. How long we keep it">
        <Table
          head={['Data', 'How long']}
          rows={[
            [
              'Account details, business profile, drafts, posts and media',
              'While your account is open. Deleted within 30 days after you close it or ask us to delete it',
            ],
            [
              'Access tokens and other data from Facebook, Instagram and LinkedIn',
              'Only while we need them to provide the service. Deleted promptly when you close your account, ask us to, or the platform asks us to',
            ],
            [
              'Sign-in and security data (IP address, browser type)',
              'While your account is open',
            ],
            [
              'Records of AI use and cost',
              'While your account is open, then deleted with it, unless they form part of billing records',
            ],
            ['Support messages', '2 years after our last contact with you'],
            [
              'Billing and tax records (once we take payments)',
              '6 years after the end of the financial year they relate to, as UK law requires',
            ],
            [
              'Backups',
              <>
                Database backups are overwritten on a rolling basis within 2
                days
              </>,
            ],
          ]}
        />
      </Section>

      <Section id="your-customers" title="9. Personal data you put into the service">
        <p>
          If you put other people&apos;s personal data into {name}, for example
          a customer&apos;s name or photo in a post, you decide what is shared
          and are the controller of that data. We process it on your behalf,
          as set out in our{' '}
          <a
            href={legalPaths.terms}
            className="text-btnPrimary underline underline-offset-2"
          >
            terms of service
          </a>
          . Please make sure you have the right to share it.
        </p>
      </Section>

      <Section id="rights" title="10. Your rights">
        <p>Under UK data protection law you have the right to:</p>
        <List>
          <li>get a copy of the personal data we hold about you;</li>
          <li>have inaccurate data corrected;</li>
          <li>have your data deleted;</li>
          <li>restrict how we use your data;</li>
          <li>object to our use of your data where we rely on legitimate interests;</li>
          <li>
            receive data you gave us in a format you can take to another
            service;
          </li>
          <li>withdraw your consent, where we rely on it, at any time.</li>
        </List>
        <p>
          To use any of these rights, email {email}. We may ask you to confirm
          your identity. We will reply within one month, and tell you if we
          need longer for a complex request. There is normally no charge.
        </p>
        <p>
          <strong>Complaints.</strong> If you are unhappy with how we have
          handled your personal data, please tell us first at {email}. We will
          acknowledge your complaint within 30 days and tell you the outcome.
          You also have the right to complain to the Information
          Commissioner&apos;s Office at{' '}
          <a
            href="https://ico.org.uk/make-a-complaint/"
            className="text-btnPrimary underline underline-offset-2"
          >
            ico.org.uk/make-a-complaint
          </a>{' '}
          or on 0303 123 1113.
        </p>
      </Section>

      <Section id="cookies" title="11. Cookies and similar storage">
        <p>
          We use only the cookies and browser storage the service needs to
          work, and to remember your choices. We do not use advertising
          cookies or third-party analytics. If that changes, we will ask for
          your consent first.
        </p>
        <Table
          head={['Name', 'What it is for', 'How long']}
          rows={[
            ['auth (cookie)', 'Keeps you signed in', 'Up to 1 year, or until you sign out'],
            [
              'org, showorg (cookies)',
              'Remembers which organisation you are working in, or an invitation you followed',
              'Up to 1 year',
            ],
            ['i18next (cookie)', 'Remembers your language', 'Until you clear your browser data'],
            [
              'impersonate (cookie)',
              'Set only in our own staff member\'s browser while they view your account to help you',
              'Until they leave your account',
            ],
            [
              'Browser local storage',
              'Remembers your time zone, display preferences and where to return after signing in, and the sign-up source described in section 2',
              'Until you clear your browser data',
            ],
          ]}
        />
      </Section>

      <Section id="security" title="12. Keeping your data safe">
        <p>
          Data travels between your browser and {name} over encrypted
          connections (HTTPS). Passwords are stored only in hashed form, and the access tokens for
          your social media accounts are stored encrypted. Access
          to our systems is limited to the people who need it to run the
          service. Our support staff can view your account when that is
          needed to help you or to keep the service safe. Our database and file storage are encrypted at rest (AES). If a breach puts your data at risk, we will tell you and the ICO
          where the law requires it.
        </p>
      </Section>

      <Section id="children" title="13. Children">
        <p>
          {name} is a service for businesses. It is not meant for anyone under
          18, and we do not knowingly collect children&apos;s data through it.
        </p>
      </Section>

      <Section id="changes" title="14. Changes to this policy">
        <p>
          We will update this policy when our service or the law changes. If
          a change matters, we will tell you by email or in the app before it
          takes effect. The date at the top shows when it last changed.
        </p>
      </Section>

      <Section id="contact" title="15. Contact us">
        <p>
          {facts.companyName}, <Fact value={facts.registeredAddress} label="registered office address" />
          . Email: {email}.
        </p>
      </Section>
    </LegalPage>
  );
};
