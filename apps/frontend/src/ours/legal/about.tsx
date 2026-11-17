// OURS: public "About" page, served at /about.html. It is the website address
// we give Meta and LinkedIn for the app: what the service does, which social
// accounts it connects and what it does with each, and links to the legal
// pages. Describes features only, never claims about customers or results.
import { FC } from 'react';
import { brand } from '@gitroom/frontend/ours/brand/brand';
import { LegalFacts, legalPaths } from '@gitroom/frontend/ours/legal/legal';
import {
  Email,
  LegalPage,
  List,
  Section,
  Table,
} from '@gitroom/frontend/ours/legal/legal.page';

export const About: FC<{ facts: LegalFacts }> = ({ facts }) => {
  const name = brand.name;
  const link = (href: string, text: string) => (
    <a href={href} className="text-btnPrimary underline underline-offset-2">
      {text}
    </a>
  );
  return (
    <LegalPage
      title={`${name}: you approve, we handle the rest`}
      current={legalPaths.about}
      facts={facts}
      plain
    >
      <p>
        {name} plans, writes and schedules social media posts for small
        businesses. Nothing is published until the business owner has
        approved it.
      </p>

      <p>
        <a
          href="/auth/login"
          className="inline-block rounded-[8px] bg-btnPrimary px-[18px] py-[10px] font-[600] text-white"
        >
          Log in
        </a>
      </p>

      <Section id="how" title="How it works">
        <List>
          <li>
            <strong>Your business profile.</strong> We read your website and
            build a short profile of your business. Every fact shows where it
            came from, and you can edit it.
          </li>
          <li>
            <strong>A week of posts.</strong> We draft a week of captions and
            simple branded graphics from your profile only, so nothing is made
            up about your business.
          </li>
          <li>
            <strong>You review.</strong> Approve, edit, reject or ask for a
            rewrite of each post. Only approved posts are scheduled.
          </li>
          <li>
            <strong>We publish and report back.</strong> Approved posts go out
            at the planned time to the accounts you connected, and we show you
            how they did.
          </li>
        </List>
      </Section>

      <Section id="accounts" title="The social accounts you can connect">
        <p>
          You connect your business&apos;s accounts yourself, through each
          platform&apos;s own login screen. You can disconnect them at any
          time.
        </p>
        <Table
          head={['Platform', 'What we do with it']}
          rows={[
            [
              'Facebook Page',
              'List the Pages you manage so you can choose one, publish the posts you approved to it, add a first comment if you wrote one, and show you reach and engagement for those posts.',
            ],
            [
              'Instagram professional account',
              'Publish the posts you approved, add a first comment if you wrote one, and show you reach and engagement for those posts.',
            ],
            [
              'LinkedIn Page',
              'List the LinkedIn Pages you administer so you can choose one, publish the posts you approved to it, and show you how those posts performed.',
            ],
          ]}
        />
        <p>
          We never post anything you have not approved, never send messages on
          your behalf, and never use data from these platforms for advertising
          or to train AI models.
        </p>
      </Section>

      <Section id="privacy" title="Your data">
        <List>
          <li>{link(legalPaths.privacy, 'Privacy policy')}</li>
          <li>{link(legalPaths.terms, 'Terms of service')}</li>
          <li>{link(legalPaths.dataDeletion, 'How to delete your data')}</li>
        </List>
      </Section>

      <Section id="contact" title="Contact">
        <p>
          Email <Email address={facts.contactEmail} />.
        </p>
      </Section>
    </LegalPage>
  );
};
