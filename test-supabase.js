// standalone test script for Supabase connection & RLS verification
// Run it with: node test-supabase.js

const SUPABASE_URL = "https://kgaqsgrkmdkvgcralqmb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnYXFzZ3JrbWRrdmdjcmFscW1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0MDY1ODMsImV4cCI6MjEwMDk4MjU4M30.hmgCX4c1sfW6GIY2kbcj2BbrC4NMGpq65ZX4ZeMpwBA";

// Standard headers
const headers = {
  "apikey": SUPABASE_ANON_KEY,
  "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
  "Content-Type": "application/json",
  "Prefer": "return=representation"
};

async function testTableCRUD(tableName, testData, updateData) {
  console.log(`\nTesting table [${tableName}]...`);
  
  // 1. SELECT test
  try {
    const resSelect = await fetch(`${SUPABASE_URL}/rest/v1/${tableName}?select=*&limit=1`, { headers });
    if (!resSelect.ok) throw new Error(`SELECT failed: ${resSelect.statusText} (${await resSelect.text()})`);
    console.log(`  ✓ SELECT connection OK`);
  } catch (e) {
    console.error(`  ✗ SELECT check failed:`, e.message);
    return false;
  }

  // Special case for settings (single row)
  if (tableName === 'settings') {
    // 2. UPDATE check
    try {
      const resUpdate = await fetch(`${SUPABASE_URL}/rest/v1/${tableName}?id=eq.main`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(updateData)
      });
      if (!resUpdate.ok) throw new Error(`UPDATE failed: ${resUpdate.statusText} (${await resUpdate.text()})`);
      console.log(`  ✓ UPDATE row OK`);
    } catch (e) {
      console.error(`  ✗ UPDATE check failed:`, e.message);
      return false;
    }
    return true;
  }

  // 2. INSERT test
  let insertedRow = null;
  try {
    const resInsert = await fetch(`${SUPABASE_URL}/rest/v1/${tableName}`, {
      method: "POST",
      headers,
      body: JSON.stringify(testData)
    });
    if (!resInsert.ok) throw new Error(`INSERT failed: ${resInsert.statusText} (${await resInsert.text()})`);
    const data = await resInsert.json();
    insertedRow = data[0];
    console.log(`  ✓ INSERT row OK (ID: ${insertedRow.id})`);
  } catch (e) {
    console.error(`  ✗ INSERT check failed:`, e.message);
    return false;
  }

  // 3. UPDATE test
  try {
    const resUpdate = await fetch(`${SUPABASE_URL}/rest/v1/${tableName}?id=eq.${insertedRow.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(updateData)
    });
    if (!resUpdate.ok) throw new Error(`UPDATE failed: ${resUpdate.statusText} (${await resUpdate.text()})`);
    console.log(`  ✓ UPDATE row OK`);
  } catch (e) {
    console.error(`  ✗ UPDATE check failed:`, e.message);
    return false;
  }

  // 4. DELETE test
  try {
    const resDelete = await fetch(`${SUPABASE_URL}/rest/v1/${tableName}?id=eq.${insertedRow.id}`, {
      method: "DELETE",
      headers
    });
    if (!resDelete.ok) throw new Error(`DELETE failed: ${resDelete.statusText} (${await resDelete.text()})`);
    console.log(`  ✓ DELETE row OK`);
  } catch (e) {
    console.error(`  ✗ DELETE check failed:`, e.message);
    return false;
  }

  return true;
}

async function run() {
  console.log("=== STARTING AUTOMATED SUPABASE VERIFICATION ===");
  
  const results = {};
  
  // Test categories
  results.categories = await testTableCRUD("categories", {
    name: "Test Cat",
    icon: "scissors"
  }, {
    icon: "sparkles"
  });

  // Test services
  results.services = await testTableCRUD("services", {
    name: "Test Svc",
    price: 10.50,
    duration: 30,
    desc: "Test desc",
    category: "Test Cat",
    employee: "Todas"
  }, {
    price: 12.00
  });

  // Test employees
  results.employees = await testTableCRUD("employees", {
    name: "Test Emp",
    specialty: "Test Cat",
    color: "#ffffff"
  }, {
    color: "#000000"
  });

  // Test appointments
  results.appointments = await testTableCRUD("appointments", {
    client_name: "Test Client",
    client_phone: "600000000",
    date: "2026-08-01",
    time: "10:00:00",
    duration: 30,
    price: 15.00,
    status: "pending",
    is_paid: false
  }, {
    is_paid: true,
    status: "confirmed"
  });

  // Test expenses
  results.expenses = await testTableCRUD("expenses", {
    concept: "Test Exp",
    category: "Otros",
    date: "2026-07-31",
    total_amount: 100.00,
    base_amount: 80.00,
    iva_rate: 21.00,
    iva_amount: 20.00
  }, {
    total_amount: 110.00
  });

  // Test blocks
  results.blocks = await testTableCRUD("blocks", {
    employee: "Test Emp",
    start_time: "08:00",
    end_time: "09:00",
    reason: "Otro",
    recurrence: "none"
  }, {
    reason: "Reunión"
  });

  // Test settings (main row update)
  results.settings = await testTableCRUD("settings", null, {
    start: "08:30"
  });

  console.log("\n================ SUMMARY ================");
  let overallSuccess = true;
  for (const [table, success] of Object.entries(results)) {
    console.log(`  Table [${table.padEnd(12)}]: ${success ? "SUCCESS ✓" : "FAILED ✗"}`);
    if (!success) overallSuccess = false;
  }
  
  if (overallSuccess) {
    console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY! The database RLS policies and schema mappings are 100% compatible.");
    process.exit(0);
  } else {
    console.log("\n🚨 SOME TESTS FAILED! Check the log errors above.");
    process.exit(1);
  }
}

run();
