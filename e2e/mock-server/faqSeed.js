'use strict';
/**
 * FAQ Hub seed for the mock backend: 6 buckets > 18 categories > 36 active FAQs (+1 inactive one that must never be served).
 * Same buckets / categories as the real starter data (SPEC 1b). Ids follow the order below; sort_order = id * 10, EXCEPT the
 * two Plans & Billing FAQs (ids 27 / 28) whose sort order is swapped, so a client that sorts by id instead of sort order shows.
 */
const ROWS = [
  // ── Set up & Account ───────────────────────────────────────────────────────────────────────────────
  ['Set up & Account', 'Getting Started', 'How do I log in as an admin?', 'Open the app and tap Admin login.\nEnter your email and password.\nIf you forgot your password, tap Forgot password on the same screen.'],
  ['Set up & Account', 'Getting Started', 'What should I do first after registering?', '1. Add your company details.\n2. Add branches and departments.\n3. Add your staff.\n4. Set the shifts and the attendance rule.'],
  ['Set up & Account', 'Account & Security', 'How do I change my password?', 'Open Settings > Account and choose Change password.\nEnter the old password and the new one twice.'],
  ['Set up & Account', 'Account & Security', 'Can I use my account on two phones?', 'Yes, the admin account works on more than one phone.\nStaff accounts are tied to one registered device: a new phone needs a device change request.'],
  ['Set up & Account', 'Company Setup', 'How do I add another branch?', 'Open Settings > Branches and tap Add branch.\nGive it a name and mark its location on the map.'],
  ['Set up & Account', 'Company Setup', 'How do I create departments?', 'Open Settings > Departments, tap Add department and type its name.'],
  ['Set up & Account', 'Staff Management', 'How do I add a new staff member?', 'Open Settings > Staff and tap Add staff.\nFill in the name, phone number, branch and shift, then save.\nThe staff member can log in with that phone number.'],
  ['Set up & Account', 'Staff Management', 'How do I remove a staff member?', "Open the staff member's profile and choose Deactivate.\nTheir past attendance stays in your reports."],
  // ── Attendance & Time ──────────────────────────────────────────────────────────────────────────────
  ['Attendance & Time', 'Attendance & Face Punch', 'How does face punch work?', 'Staff tap Punch In on their home screen.\nThe app takes a selfie and checks it against the registered face.\nThe punch is saved only when the face matches.'],
  ['Attendance & Time', 'Attendance & Face Punch', 'Why was my punch rejected?', 'Common reasons:\n- You are outside the allowed location\n- The face did not match\n- The daily punch limit was reached'],
  ['Attendance & Time', 'Shifts', 'How do I create a shift?', 'Open Settings > Shifts and tap Add shift.\nSet the start and end time and the grace period.'],
  ['Attendance & Time', 'Shifts', 'Can one person have more than one shift?', 'Yes. Staff can work different shifts on different days.\nAssign the shift from their profile or approve their shift change request.'],
  ['Attendance & Time', 'Holidays & Rules', 'How do I add a holiday?', 'Open Settings > Holidays and tap Add holiday.\nPick the date and give it a name.'],
  ['Attendance & Time', 'Holidays & Rules', 'What is the attendance rule?', 'The attendance rule sets the grace time, the half-day hours and the late marks.\nFind it under Settings > Attendance rule.'],
  ['Attendance & Time', 'Leave & Requests', 'How do I approve a leave request?', 'Open Requests > Leave.\nTap a request and choose Approve or Reject.'],
  ['Attendance & Time', 'Leave & Requests', 'What is a permission request?', 'A permission request lets staff ask for a short time off during the day, for example two hours.'],
  ['Attendance & Time', 'Reports & Analytics', 'How do I download the monthly attendance report?', 'Open Reports > Monthly attendance, choose the month and tap Download.'],
  ['Attendance & Time', 'Reports & Analytics', 'Where can I see who was late today?', "Open Reports > Late report and pick today's date."],
  // ── Pay & Expenses ─────────────────────────────────────────────────────────────────────────────────
  ['Pay & Expenses', 'Payroll & Salary', 'Where is the salary sheet?', 'Open Payroll > Salary sheet and choose the month.\nYou can download it as a spreadsheet.'],
  ['Pay & Expenses', 'Payroll & Salary', 'How is the monthly salary calculated?', 'The monthly salary is divided by the days of the month and multiplied by the days present.\nBonuses and overtime are added.'],
  ['Pay & Expenses', 'Expenses & Advances', 'How do staff submit travel expenses?', 'Staff open Expenses > Travel, add the trip and attach a photo of the bill.\nYou approve it under Expenses.'],
  ['Pay & Expenses', 'Expenses & Advances', 'How do I record a salary advance?', "Open the staff member's profile > Advance and enter the amount and the date.\nIt is deducted from the next salary sheet."],
  // ── Team & Customers ───────────────────────────────────────────────────────────────────────────────
  ['Team & Customers', 'CRM & Leads', 'How do I add a lead?', 'Open CRM > Leads and tap Add lead.\nFill in the customer details and save.'],
  ['Team & Customers', 'CRM & Leads', 'Can staff see all the leads?', 'No. Staff see only the leads assigned to them.'],
  ['Team & Customers', 'Chat & Announcements', 'How do I send an announcement?', 'Open Chat > Announcements, write your message and tap Send.\nChoose everyone or selected staff.'],
  ['Team & Customers', 'Chat & Announcements', 'Can I chat with one staff member?', 'Yes. Open Chat > Direct and pick the person.'],
  // ── Plans & Payments ───────────────────────────────────────────────────────────────────────────────
  ['Plans & Payments', 'Plans & Billing', 'How do I upgrade my plan?', 'Open Settings > Billing.\nTap Upgrade, choose a plan and pay.\nYour new plan starts immediately and the invoice appears under Invoices.'],
  ['Plans & Payments', 'Plans & Billing', 'How do I apply a coupon?', 'On the checkout screen, enter your coupon code and tap Apply.\nThe discount shows before you pay.'],
  ['Plans & Payments', 'Payments & Invoices', 'Where can I download invoices?', 'Open Settings > Billing > Invoices.\nTap an invoice to download the PDF.'],
  ['Plans & Payments', 'Payments & Invoices', 'Which payment methods are accepted?', 'The methods you can use are shown on the payment screen at checkout.'],
  // ── Help & Fixes ───────────────────────────────────────────────────────────────────────────────────
  ['Help & Fixes', 'Notifications & Permissions', 'Why am I not getting notifications?', 'Open the Permissions screen and allow notifications.\nAlso check that battery saver is not blocking the app.'],
  ['Help & Fixes', 'Notifications & Permissions', 'Why does the app ask for my location?', 'The location is used to check that staff punch in from an allowed place.'],
  ['Help & Fixes', 'Troubleshooting', 'The app shows a blank screen, what can I do?', 'Close and reopen the app, check your internet connection and update to the latest version.'],
  ['Help & Fixes', 'Troubleshooting', 'I forgot my password', 'Tap Forgot password on the login screen and follow the steps.'],
  ['Help & Fixes', 'Support & Feedback', 'How do I contact support?', 'Open the Support tab and choose Live Chat.\nOur team replies in the chat.'],
  ['Help & Fixes', 'Support & Feedback', 'How can I suggest a feature?', 'Open Settings > Suggest a feature and describe your idea.'],
];

/** Fresh rows (the state of one tenant is mutated by tests). */
function faqSeed() {
  const faqs = ROWS.map(([faq_bucket, category, question, answer], i) => ({ id: i + 1, faq_bucket, category, question, answer, sort_order: (i + 1) * 10, status: 1 }));
  const swap = (a, b) => {
    const fa = faqs.find((f) => f.id === a);
    const fb = faqs.find((f) => f.id === b);
    [fa.sort_order, fb.sort_order] = [fb.sort_order, fa.sort_order];
  };
  swap(27, 28); // "upgrade my plan" (27) is served AFTER "apply a coupon" (28)
  faqs.push({ id: 99, faq_bucket: 'Help & Fixes', category: 'Troubleshooting', question: 'Retired question that must stay hidden', answer: 'This FAQ is inactive and must never be shown in the app.', sort_order: 5, status: 0 });
  return faqs;
}

module.exports = { faqSeed, FAQ_ACTIVE_COUNT: ROWS.length };
