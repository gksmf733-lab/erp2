export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  employee_id?: string;
}

export interface Employee {
  id: string;
  employee_number: string;
  name: string;
  department: string;
  position: string;
  email: string;
  phone: string;
  hire_date: string;
  salary: number;
  status: string;
  created_at: string;
}

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  description: string;
  date: string;
  created_at: string;
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  unit_price: number;
  min_quantity: number;
  location: string;
  created_at: string;
}

export interface Customer {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  phone2: string;
  business_number: string;
  industry: string;
  business_type: string;
  address: string;
  status: string;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name?: string;
  customer_company?: string;
  assignee_id?: string;
  assignee_name?: string;
  total_amount: number;
  status: 'pending' | 'processing' | 'near_due' | 'completed' | 'cancelled';
  order_date: string;
  start_date?: string;
  due_date: string;
  notes: string;
  created_at: string;
}

export interface Service {
  id: string;
  service_code: string;
  name: string;
  category: string;
  description: string;
  price: number;
  unit: string;
  duration: string;
  status: 'active' | 'inactive';
  is_blog: boolean;
  created_at: string;
  vendor_id?: string;
  vendor_name?: string;
}

export interface DashboardSummary {
  employees: {
    total: number;
  };
  finance: {
    income: number;
    expense: number;
    balance: number;
    vendorExpense: number;
    refund: number;
    incentive: number;
  };
  settlement: {
    expected: number;
    confirmed: number;
  };
  sales: {
    customers: number;
    totalOrders: number;
    pendingOrders: number;
    todayOrders: number;
    totalSales: number;
  };
  period: string;
}
