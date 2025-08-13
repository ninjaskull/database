/**
 * Utility functions for employee size bracket management
 */

export function getEmployeeSizeBracket(employees: number | string | null | undefined): string {
  if (!employees) return '';
  
  const employeeCount = typeof employees === 'string' ? parseInt(employees.replace(/[^\d]/g, '')) : employees;
  
  if (isNaN(employeeCount) || employeeCount < 0) {
    return '';
  }
  
  if (employeeCount <= 10) {
    return '1-10';
  } else if (employeeCount <= 50) {
    return '11-50';
  } else if (employeeCount <= 200) {
    return '51-200';
  } else if (employeeCount <= 1000) {
    return '201-1000';
  } else {
    return '1000+';
  }
}

/**
 * Get the standard size brackets available in the system
 */
export const EMPLOYEE_SIZE_BRACKETS = [
  '1-10',
  '11-50',
  '51-200',
  '201-1000',
  '1000+'
] as const;

export type EmployeeSizeBracket = typeof EMPLOYEE_SIZE_BRACKETS[number];