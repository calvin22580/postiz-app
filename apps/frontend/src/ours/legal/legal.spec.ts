// OURS: checks our legal pages print the company's facts, never guess the
// missing ones, and cover what Meta and LinkedIn ask a privacy policy to say.
import { describe, expect, it } from 'vitest';
import { createElement, FC } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  LegalFacts,
  legalFacts,
  legalPaths,
  missingFacts,
} from '@gitroom/frontend/ours/legal/legal';
import { PrivacyPolicy } from '@gitroom/frontend/ours/legal/privacy.policy';
import { TermsOfService } from '@gitroom/frontend/ours/legal/terms.of.service';
import { DataDeletion } from '@gitroom/frontend/ours/legal/data.deletion';
import { About } from '@gitroom/frontend/ours/legal/about';

const complete: Record<string, string> = {
  NEXT_PUBLIC_LEGAL_COMPANY_NUMBER: '01234567',
  NEXT_PUBLIC_LEGAL_REGISTERED_ADDRESS: '1 Test Street, Testtown, TE1 1ST',
  NEXT_PUBLIC_LEGAL_ICO_NUMBER: 'ZA000000',
  NEXT_PUBLIC_LEGAL_LAST_UPDATED: '01/12/2026',
  NEXT_PUBLIC_LEGAL_REVIEWED: 'true',
};

const render = (page: FC<{ facts: LegalFacts }>, facts: LegalFacts) =>
  renderToStaticMarkup(createElement(page, { facts }));

const pages = [PrivacyPolicy, TermsOfService, DataDeletion];

describe('legal facts', () => {
  it('uses the defaults and lists what is still to be filled in', () => {
    const facts = legalFacts({});
    expect(facts.companyName).toBe('Steady Lamp Ltd');
    expect(facts.contactEmail).toBe('support@kanosena.com');
    expect(facts.reviewed).toBe(false);
    expect(facts.companyNumber).toBe('17533499');
    expect(facts.registeredAddress).toBe('128 City Road, London, EC1V 2NX');
    expect(facts.lastUpdated).toBe('17/11/2026');
    expect(missingFacts(facts)).toEqual(['icoNumber']);
  });

  it('takes every value from the environment when set', () => {
    const facts = legalFacts({
      ...complete,
      NEXT_PUBLIC_LEGAL_CONTACT_EMAIL: 'privacy@example.co.uk',
    });
    expect(missingFacts(facts)).toEqual([]);
    expect(facts.contactEmail).toBe('privacy@example.co.uk');
    expect(facts.reviewed).toBe(true);
  });
});

describe('legal pages', () => {
  it('mark missing facts and the draft status instead of guessing', () => {
    for (const page of pages) {
      const html = render(page, legalFacts({}));
      expect(html).toContain('data-testid="legal-draft"');
      expect(html).toContain('17/11/2026');
    }
    expect(render(PrivacyPolicy, legalFacts({}))).toContain(
      '[FILL IN: ICO registration number]'
    );
  });

  it('print the facts once they are set', () => {
    const facts = legalFacts(complete);
    const html = render(PrivacyPolicy, facts);
    expect(html).toContain('01234567');
    expect(html).toContain('ZA000000');
    expect(html).not.toContain('[FILL IN: company number]');
    expect(html).not.toContain('data-testid="legal-draft"');
  });

  it('privacy policy covers what Meta and LinkedIn ask for', () => {
    const html = render(PrivacyPolicy, legalFacts({}));
    // how users request deletion (Meta Platform Terms 4.b, LinkedIn 5.1)
    expect(html).toContain(`href="${legalPaths.dataDeletion}"`);
    expect(html).toContain('mailto:support@kanosena.com');
    // what we process from the platforms, and the limits on it
    expect(html).toContain('Data from Facebook, Instagram and LinkedIn');
    expect(html).toContain('We do not sell, license or buy platform data.');
    // AI disclosures (LinkedIn developer AI policy, section III)
    expect(html).toContain('AI can still make mistakes');
    // the right to complain to the ICO
    expect(html).toContain('ico.org.uk/make-a-complaint');
  });

  it('every page links to every public page and never names upstream', () => {
    for (const page of pages) {
      const html = render(page, legalFacts({}));
      for (const path of Object.values(legalPaths)) {
        expect(html).toContain(`href="${path}"`);
      }
      // the repository URL (postiz-app) is fine; the product name is not
      expect(html).not.toMatch(/\bPostiz\b/);
    }
  });
});

describe('about page', () => {
  it('is a plain public page that links to the legal pages and log-in', () => {
    const html = render(About, legalFacts({}));
    // the website address given to Meta and LinkedIn: not a draft legal page
    expect(html).not.toContain('data-testid="legal-draft"');
    expect(html).not.toContain('[FILL IN');
    for (const path of Object.values(legalPaths)) {
      expect(html).toContain(`href="${path}"`);
    }
    expect(html).toContain('href="/auth/login"');
    expect(html).toContain('mailto:support@kanosena.com');
    expect(html).not.toMatch(/\bPostiz\b/);
  });

  it('says what each connected platform is used for', () => {
    const html = render(About, legalFacts({}));
    for (const platform of ['Facebook Page', 'Instagram professional account', 'LinkedIn Page']) {
      expect(html).toContain(platform);
    }
    expect(html).toContain('Nothing is published until the business owner has');
  });
});
