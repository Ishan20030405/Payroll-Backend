const app = require('./src/app');
const http = require('http');

async function runTests() {
    console.log('Starting test server...');
    const server = http.createServer(app);
    
    server.listen(4005, async () => {
        try {
            console.log('Testing Department model...');
            const Department = require('./src/models/Department');
            
            // Test: Get all departments
            const allDeps = await Department.getAll();
            console.log('All Departments:', allDeps.length);
            if (allDeps.length > 0) {
                console.log('First department:', allDeps[0]);
            }

            // Test: Create a new department with department_id
            const testId = 'DEP-TEST-' + Date.now().toString().slice(-6);
            console.log(`\nCreating department with ID: ${testId}`);
            
            const newId = await Department.create({
                department_id: testId,
                department_name: 'Test Dept',
                department_head: 'John Doe',
                status: 'Active'
            });
            console.log('Created department ID:', newId);
            
            // Test: Find by ID
            const found = await Department.findById(testId);
            console.log('Found department:', found ? found.department_name : 'Not found');

            // Test: Update department
            await Department.update(testId, { department_name: 'Updated Test Dept' });
            
            const updated = await Department.findById(testId);
            console.log('Updated Dept Name:', updated ? updated.department_name : 'Not found');
            
            // Test: Search
            const searchResults = await Department.search('Test');
            console.log('Search results:', searchResults.length);

            // Test: Delete department
            await Department.delete(testId);
            console.log('Test Dept deleted successfully.');

            console.log('\n✅ All tests passed.');
        } catch (error) {
            console.error('❌ Test failed:', error);
        } finally {
            server.close();
            process.exit(0);
        }
    });
}

runTests();

