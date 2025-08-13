-- Demo data for testing smart company auto-fill functionality

-- Insert sample contacts with complete company information
INSERT INTO contacts (
  full_name, first_name, last_name, title, email, mobile_phone, 
  company, employees, employee_size_bracket, industry, website, 
  company_linkedin, technologies, annual_revenue, 
  company_address, company_city, company_state, company_country,
  lead_score, company_age, technology_category, business_type
) VALUES 
(
  'Sarah Johnson', 'Sarah', 'Johnson', 'CTO', 'sarah.johnson@techcorp.com', '+1-555-0123',
  'TechCorp Solutions', 150, '51-200', 'Technology', 'https://techcorp.com',
  'https://linkedin.com/company/techcorp', 
  ARRAY['React', 'Node.js', 'PostgreSQL', 'AWS'],
  '25000000',
  '123 Innovation Drive', 'San Francisco', 'CA', 'United States',
  8.5, 7, 'Enterprise Software', 'SaaS'
),
(
  'Michael Chen', 'Michael', 'Chen', 'Lead Developer', 'michael.chen@innovate.co', '+1-555-0456',
  'Innovate Inc', 45, '11-50', 'Technology', 'https://innovate.co',
  'https://linkedin.com/company/innovate-inc',
  ARRAY['Python', 'Django', 'React', 'Docker'],
  '5200000',
  '456 Startup Lane', 'Austin', 'TX', 'United States',
  7.2, 3, 'Web Development', 'B2B Software'
),
(
  'Emily Davis', 'Emily', 'Davis', 'VP Marketing', 'emily.davis@healthplus.org', '+1-555-0789',
  'HealthPlus Medical', 320, '200+', 'Healthcare', 'https://healthplus.org',
  'https://linkedin.com/company/healthplus-medical',
  ARRAY['EMR Systems', 'Telemedicine', 'HIPAA Compliance'],
  '75000000',
  '789 Medical Center Blvd', 'Boston', 'MA', 'United States',
  9.1, 15, 'Healthcare Technology', 'Medical Services'
);