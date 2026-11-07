-- Skills autocomplete that works from day one.
--
-- Before: suggestions came only from skills other users had typed, so on a
-- new platform typing "Design" or "Marketing" found nothing, and matches came
-- back unranked. Now: a curated starter list (users can still add their own,
-- docs/OPEN_DECISIONS.md "Skills taxonomy"), and a ranked search.

insert into public.skills (name)
-- Generated from features/profile/skillCatalog.json (keep in sync; a test checks).
select n from unnest(array[
  'Product design', 'UX design', 'UI design', 'User research', 'Usability testing',
  'Interaction design', 'Service design', 'Design systems', 'Graphic design', 'Brand design',
  'Brand identity', 'Logo design', 'Web design', 'Mobile app design', 'Motion design',
  'Animation', 'Illustration', 'Figma', 'Sketch', 'Adobe Photoshop', 'Adobe Illustrator',
  'Adobe InDesign', 'Adobe After Effects', 'Prototyping', 'Wireframing', 'Accessibility',
  'Packaging design', 'Print design', 'Editorial design', '3D design', '3D modelling',
  'Presentation design', 'Information design', 'Content design', 'Industrial design',
  'Interior design', 'Fashion design', 'Architecture', 'Software engineering',
  'Software development', 'Engineering management', 'Technical leadership',
  'Solutions architecture', 'Software architecture', 'Web development', 'Frontend development',
  'Backend development', 'Full-stack development', 'Mobile app development', 'iOS development',
  'Android development', 'Cross-platform development', 'React', 'React Native', 'Next.js',
  'Vue.js', 'Nuxt', 'Angular', 'Svelte', 'HTML', 'CSS', 'Tailwind CSS', 'TypeScript',
  'JavaScript', 'Node.js', 'Express', 'NestJS', 'Python', 'Django', 'Flask', 'FastAPI', 'Ruby',
  'Ruby on Rails', 'Go', 'Rust', 'Java', 'Spring Boot', 'Kotlin', 'Swift', 'SwiftUI',
  'Objective-C', 'Flutter', 'Dart', 'PHP', 'Laravel', 'Symfony', 'C', 'C++', 'C#', '.NET',
  'Elixir', 'Scala', 'R', 'SQL', 'Postgres', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch',
  'GraphQL', 'REST APIs', 'API design', 'Microservices', 'Supabase', 'Firebase', 'AWS',
  'Google Cloud', 'Azure', 'Cloud architecture', 'DevOps', 'CI/CD', 'Docker', 'Kubernetes',
  'Terraform', 'Linux', 'Site reliability engineering', 'Platform engineering',
  'Data engineering', 'Data pipelines', 'ETL', 'dbt', 'Snowflake', 'BigQuery',
  'Machine learning', 'Deep learning', 'AI engineering', 'Generative AI', 'LLM applications',
  'Prompt engineering', 'Computer vision', 'Natural language processing', 'MLOps',
  'Data science', 'Statistics', 'QA testing', 'Test automation', 'Manual testing',
  'Performance testing', 'Cybersecurity', 'Penetration testing', 'Security engineering',
  'Identity and access management', 'Networking', 'IT support', 'Systems administration',
  'Shopify', 'WordPress', 'Webflow', 'Wix', 'Squarespace', 'No-code', 'Low-code', 'Bubble',
  'Zapier', 'Automation', 'Salesforce development', 'Embedded systems', 'Firmware', 'IoT',
  'Robotics', 'Game development', 'Unity', 'Unreal Engine', 'AR/VR development',
  'Blockchain development', 'Smart contracts', 'Mechanical engineering',
  'Electrical engineering', 'Electronics engineering', 'Civil engineering',
  'Structural engineering', 'Chemical engineering', 'Manufacturing engineering',
  'Aerospace engineering', 'Biomedical engineering', 'Environmental engineering', 'CAD',
  'SolidWorks', 'AutoCAD', 'PCB design', 'Product management', 'Product strategy',
  'Product ownership', 'Product discovery', 'Roadmapping', 'Agile', 'Scrum', 'Kanban',
  'Project management', 'Programme management', 'Delivery management', 'Business analysis',
  'Requirements gathering', 'Process improvement', 'Change management', 'Marketing',
  'Digital marketing', 'Marketing strategy', 'Growth marketing', 'Growth hacking',
  'Performance marketing', 'Product marketing', 'Content marketing', 'Content strategy',
  'Copywriting', 'SEO', 'Paid social', 'Paid search', 'PPC', 'Google Ads', 'Meta ads',
  'LinkedIn ads', 'TikTok ads', 'Email marketing', 'Lifecycle marketing', 'Marketing automation',
  'Social media marketing', 'Social media management', 'Community management',
  'Influencer marketing', 'Brand strategy', 'Brand marketing', 'PR', 'Media relations',
  'Communications', 'Internal communications', 'Marketing analytics',
  'Conversion rate optimisation', 'A/B testing', 'Affiliate marketing', 'Event marketing',
  'Event management', 'Field marketing', 'B2B marketing', 'B2C marketing', 'Demand generation',
  'Account-based marketing', 'Go-to-market strategy', 'Market research', 'Customer research',
  'Content creation', 'Video production', 'Video editing', 'Photography', 'Videography',
  'Podcast production', 'Audio editing', 'Sound design', 'Music production', 'UGC content',
  'YouTube', 'TikTok', 'Sales', 'B2B sales', 'SaaS sales', 'Business development',
  'Account management', 'Lead generation', 'Sales development', 'Cold outreach', 'Partnerships',
  'Customer success', 'Customer support', 'Customer experience', 'CRM', 'HubSpot', 'Salesforce',
  'Pipedrive', 'Negotiation', 'Data analysis', 'Data visualisation', 'Business intelligence',
  'Excel', 'Google Sheets', 'Power BI', 'Tableau', 'Looker', 'Google Analytics',
  'Product analytics', 'Mixpanel', 'Amplitude', 'Bookkeeping', 'Accounting',
  'Management accounts', 'Tax', 'Payroll', 'Xero', 'QuickBooks', 'Financial modelling',
  'Financial planning', 'FP&A', 'Fundraising', 'Investor relations', 'Pitch decks',
  'Business plans', 'Grant applications', 'Operations', 'Business operations', 'Supply chain',
  'Logistics', 'Procurement', 'Recruitment', 'Talent acquisition', 'HR', 'People operations',
  'Learning and development', 'Legal', 'Contract drafting', 'Commercial law', 'Employment law',
  'Intellectual property', 'Compliance', 'Data protection', 'GDPR', 'Risk management',
  'Virtual assistance', 'Administration', 'Executive assistance', 'Office management',
  'Technical writing', 'Content writing', 'Blog writing', 'Ghostwriting', 'Scriptwriting',
  'UX writing', 'Editing', 'Proofreading', 'Translation', 'Localisation', 'Grant writing',
  'Research', 'Business strategy', 'Strategy consulting', 'Management consulting',
  'Startup advisory', 'Entrepreneurship', 'Leadership', 'Coaching', 'Mentoring', 'Training',
  'Public speaking', 'Facilitation', 'E-commerce', 'Marketplace operations', 'Sustainability',
  'ESG', 'Healthcare', 'Fintech', 'Edtech', 'Education', 'Tutoring', 'Teaching'
]) as n
on conflict ((lower(name))) do nothing;

-- Ranked search: exact match, then names starting with the query, then the
-- most used, then alphabetical. Runs as the caller (column grants allow id,
-- name; profile_skills is readable to signed-in users).
create function public.search_skills(p_query text)
returns table (name text)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (
    select lower(btrim(coalesce(p_query, ''))) as t
  )
  select s.name
  from public.skills s, q
  where char_length(q.t) between 1 and 60
    and strpos(lower(s.name), q.t) > 0
  order by
    (lower(s.name) = q.t) desc,
    (left(lower(s.name), char_length(q.t)) = q.t) desc,
    (select count(*) from public.profile_skills ps where ps.skill_id = s.id) desc,
    s.name
  limit 10;
$$;

revoke execute on function public.search_skills(text) from public, anon;
grant execute on function public.search_skills(text) to authenticated;
