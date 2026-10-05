/* iConnect Partner Portal configuration.
   The Supabase URL and anon key are PUBLIC by design (safe to commit).
   Access to data is enforced by the row-level security rules in the database,
   never by hiding these values. NEVER put a service_role key in this file. */
window.PORTAL_CONFIG = {
  supabaseUrl: 'https://bgwkicngvhuntmtnjbtv.supabase.co',
  supabaseAnonKey: 'sb_publishable_Tq2uG9J40umZgWW0pZDk7g_sV2E6VI1',

  /* Terms that fill the blanks in the Website & Brand Exposure Agreement.
     The agreement cannot be signed until every required value is set. */
  agreement: {
    version: '1.0',
    iconnect: {
      registeredName: 'iConnect',
      regNo: '',                       // optional: shown in the agreement once filled in
      address: '',                     // optional: shown in the agreement once filled in
      website: 'iconnectpartners.com',
      contact: 'Grant Neal, Founder & Principal Consultant',
      email: 'grant@iconnectpartners.com'
    },
    signatory: { name: 'Grant Neal', title: 'Founder & Principal Consultant' },
    assetsWithinDays: '10',              // REQUIRED: business days for the Brand to supply assets (section 4.1)
    liabilityCapIfNoFees: 'EUR 1,000',          // REQUIRED: liability cap if no fees apply (section 6.4), e.g. "USD 1,000"
    governingLaw: 'Malta',                  // REQUIRED: governing law and courts (section 6.7), e.g. "Malta"
    fee: {                             // REQUIRED: choose one option
      option: 'none',                      // 'none' | 'fee' | 'separate'
      amount: '', currency: '', per: '', invoiced: '',   // used when option is 'fee'
      separateDate: ''                 // used when option is 'separate'
    }
  }
};
