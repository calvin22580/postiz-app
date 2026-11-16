// OURS: data deletion instructions. Meta's app settings take either a data
// deletion callback or the URL of a page like this one; LinkedIn's API Terms
// (sections 4.4 and 5.1) and UK GDPR (Article 17) also call for a clear way to
// ask. Sources are listed in SOURCES.md (this folder).
import { FC } from 'react';
import { brand } from '@gitroom/frontend/ours/brand/brand';
import { LegalFacts, legalPaths } from '@gitroom/frontend/ours/legal/legal';
import {
  Email,
  LegalPage,
  List,
  Section,
  Steps,
} from '@gitroom/frontend/ours/legal/legal.page';

export const DataDeletion: FC<{ facts: LegalFacts }> = ({ facts }) => {
  const name = brand.name;
  const email = <Email address={facts.contactEmail} />;
  return (
    <LegalPage
      title="How to delete your data"
      current={legalPaths.dataDeletion}
      facts={facts}
    >
      <p>
        You can ask us to delete the personal data {name} holds about you at
        any time, including everything we received from Facebook, Instagram
        and LinkedIn. You do not need to give a reason.
      </p>

      <Section id="yourself" title="Delete it yourself">
        <List>
          <li>
            <strong>Your whole account:</strong> sign in, open Settings, then
            Global Settings, and choose Delete Account. Everything listed under
            &quot;What we delete&quot; is deleted straight away.
          </li>
          <li>
            <strong>One connected account</strong>, such as your Facebook
            Page: disconnect it in {name}. Its access tokens and page details
            are deleted straight away.
          </li>
        </List>
      </Section>

      <Section id="request" title="Ask us to delete your data">
        <Steps>
          <li>
            Email {email} from the email address you use for {name}, with the
            subject &quot;Delete my data&quot;. If you cannot use that address,
            tell us which account it is and we will check it is yours before
            we act.
          </li>
          <li>
            Say whether you want your whole account deleted, or only the data
            from one connected account, such as your Facebook Page.
          </li>
          <li>
            We will reply to confirm we have your request, and email you again
            once deletion is complete. We complete requests within one month,
            and data from Facebook, Instagram and LinkedIn is deleted as soon
            as we have confirmed the request.
          </li>
        </Steps>
      </Section>

      <Section id="what-we-delete" title="What we delete">
        <List>
          <li>your account details and preferences;</li>
          <li>your business profile and the website text it was built from;</li>
          <li>your drafts, scheduled posts, uploaded images and other media;</li>
          <li>
            the access tokens, account and page details, post links and
            statistics we received from Facebook, Instagram and LinkedIn.
          </li>
        </List>
        <p>Scheduled posts that have not gone out will not be published.</p>
      </Section>

      <Section id="what-we-keep" title="What we may keep, and why">
        <List>
          <li>
            Billing and tax records, once we take payments, for as long as UK
            law requires (6 years).
          </li>
          <li>
            A short record that you asked for deletion and when we did it, so
            we can show we did.
          </li>
          <li>
            Backups, which are overwritten on a rolling basis and are not used
            to restore deleted accounts.
          </li>
          <li>
            Statistics that cannot identify you, such as total numbers of
            posts.
          </li>
        </List>
      </Section>

      <Section id="published-posts" title="Posts that are already published">
        <p>
          Deleting your {name} data does not remove posts that are already on
          Facebook, Instagram or LinkedIn. Delete those on the platform itself.
        </p>
      </Section>

      <Section id="remove-access" title="Remove our access on the platform">
        <p>
          You can also stop {name} acting for you from the platform&apos;s own
          settings, at any time:
        </p>
        <List>
          <li>
            <strong>Facebook and Instagram:</strong> in your Facebook settings,
            open the list of apps and business integrations and remove {name}.
          </li>
          <li>
            <strong>LinkedIn:</strong> in your LinkedIn settings, open Data
            privacy, then the services you have permitted, and remove {name}.
          </li>
        </List>
        <p>
          Removing access stops us publishing for you. If Facebook or LinkedIn
          passes a deletion request on to us, we act on it as if you had
          emailed us. To be sure the data we already hold is deleted, email us
          as well.
        </p>
      </Section>

      <Section id="others" title="If you are not a customer">
        <p>
          If your details appear in {name} because a business we work with
          published them on its website or in a post, email {email} and we
          will help.
        </p>
        <p>
          More detail is in our{' '}
          <a
            href={legalPaths.privacy}
            className="text-btnPrimary underline underline-offset-2"
          >
            privacy policy
          </a>
          .
        </p>
      </Section>
    </LegalPage>
  );
};
