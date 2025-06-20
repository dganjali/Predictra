import { logout } from './auth.js';

const API_BASE = window.location.hostname === 'localhost' 
    ? 'http://localhost:5002'  // Changed to match Flask server port
    : 'https://blueshacksByteBite.onrender.com';

const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

document.addEventListener("DOMContentLoaded", async () => {
    // Get both token and username from localStorage
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");
    
    if (!token) {
        window.location.href = "signin.html";
        return;
    }

    // Update username display
    const usernameDisplay = document.getElementById("username-display");
    if (usernameDisplay && username) {
        usernameDisplay.textContent = username;
    }

    const inventoryBody = document.getElementById("inventory-body");
    const addStockForm = document.getElementById("add-stock-form");
    const foodTypeInput = document.getElementById("food-type");
    const suggestionsList = document.getElementById("suggestions-list");

    // Logout functionality
    document.getElementById("logoutButton").addEventListener("click", logout);

    // Fetch inventory data and update the table
    const fetchInventory = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/inventory`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const inventoryData = await response.json();
            
            // Update inventory table
            inventoryBody.innerHTML = "";
            inventoryData.forEach(item => {
                const row = createInventoryRow(item);
                inventoryBody.appendChild(row);
            });
            
            // Fetch distribution plan
            await fetchDistributionPlan(inventoryData);
            
        } catch (error) {
            console.error("Failed to load inventory data", error);
        }
    };

    // Add this function after fetchInventory
    const fetchDistributionPlan = async () => {
        try {
            console.log('Fetching from:', `${API_BASE}/predict`); // Debug log
            const response = await fetch(`${API_BASE}/predict`, { // Remove /api/ prefix
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ user_id: localStorage.getItem('userId') }) // Add user_id
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            if (data.success) {
                updateDistributionPlanTable(data.distribution_plan);
            } else {
                console.error('Failed to get distribution plan:', data.error);
            }
        } catch (error) {
            console.error('Error fetching distribution plan:', error);
            // Show user-friendly error message
            const tableBody = document.getElementById('distribution-plan-body');
            tableBody.innerHTML = `<tr><td colspan="5">Error loading distribution plan. Please try again.</td></tr>`;
        }
    };

    const updateDistributionPlanTable = (distributionPlan) => {
        const tableBody = document.getElementById('distribution-plan-body');
        tableBody.innerHTML = '';
        
        // distributionPlan is already limited to 10 items from the backend
        distributionPlan.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.food_item}</td>
                <td>${item.current_quantity}</td>
                <td>${Math.round(item.recommended_quantity)}</td>
                <td>${item.priority_score.toFixed(2)}</td>
                <td>${item.rank}</td>
            `;
            tableBody.appendChild(row);
        });

        if (distributionPlan.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = '<td colspan="5">No items in distribution plan</td>';
            tableBody.appendChild(row);
        }
    };

    // Update the inventory table row creation
    const createInventoryRow = (item) => {
        const daysUntilExpiry = Math.ceil((new Date(item.expiration_date) - new Date()) / (1000 * 60 * 60 * 24));
        const nutritionalRatio = item.nutritional_value.calories / (item.nutritional_value.sugars + 1);
        
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${item.type}</td>
            <td>${item.food_type}</td>
            <td>${item.quantity}</td>
            <td>${new Date(item.expiration_date).toLocaleDateString()}</td>
            <td>${daysUntilExpiry}</td>
            <td>${item.nutritional_value.calories}</td>
            <td>${item.nutritional_value.sugars}</td>
            <td>${item.weekly_customers}</td>
            <td>${nutritionalRatio.toFixed(2)}</td>
            <td>
                <button class="btn-delete" onclick="deleteItem('${item._id}')">Delete</button>
            </td>
        `;
        return row;
    };

    // Add delete function
    window.deleteItem = async (itemId) => {
        if (!confirm('Are you sure you want to delete this item?')) return;

        try {
            const response = await fetch(`${API_BASE}/api/inventory/delete/${itemId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                fetchInventory(); // Refresh the table
            } else {
                alert('Failed to delete item');
            }
        } catch (error) {
            console.error('Error deleting item:', error);
            alert('Error deleting item');
        }
    };

    // Update the add stock form handler
    const addStockFormHandler = async (e) => {
        e.preventDefault();

        const type = foodTypeInput.value;
        const category = document.getElementById("food-category").value;
        const quantity = document.getElementById("quantity").value;
        const expiration_date = document.getElementById("expiration-date").value;

        if (!type || !category || !quantity || !expiration_date) {
            alert("Please fill in all fields");
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/api/inventory/add`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ 
                    type, 
                    category,
                    quantity: Number(quantity), 
                    expiration_date 
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || data.details || 'Failed to add stock');
            }

            if (data.success) {
                const row = createInventoryRow(data.newItem);
                inventoryBody.insertBefore(row, inventoryBody.firstChild);
                addStockForm.reset();
                await fetchInventory();
            }
        } catch (error) {
            console.error("Error adding stock:", error);
            alert(error.message || "An error occurred while adding stock");
        }
    };

    addStockForm.addEventListener("submit", addStockFormHandler);

    // Add autocomplete functionality
    const handleFoodTypeInput = async (query) => {
        if (!query) {
            suggestionsList.innerHTML = '';
            suggestionsList.classList.remove('active');
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/api/search?query=${encodeURIComponent(query)}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) throw new Error('Failed to fetch suggestions');
            
            const suggestions = await response.json();
            
            suggestionsList.innerHTML = '';
            if (suggestions.length > 0) {
                suggestionsList.classList.add('active');
                suggestions.forEach(suggestion => {
                    const div = document.createElement('div');
                    div.className = 'suggestion-item';
                    div.textContent = suggestion;
                    div.addEventListener('click', () => {
                        foodTypeInput.value = suggestion;
                        suggestionsList.innerHTML = '';
                        suggestionsList.classList.remove('active');
                    });
                    suggestionsList.appendChild(div);
                });
            } else {
                suggestionsList.classList.remove('active');
            }
        } catch (error) {
            console.error('Error fetching suggestions:', error);
        }
    };

    // Add input event listener with debounce
    foodTypeInput.addEventListener('input', debounce((e) => {
        handleFoodTypeInput(e.target.value);
    }, 300));

    // Close suggestions when clicking outside
    document.addEventListener('click', (e) => {
        if (!foodTypeInput.contains(e.target) && !suggestionsList.contains(e.target)) {
            suggestionsList.classList.remove('active');
        }
    });

    // Initial fetch of inventory
    fetchInventory();

    // Add weekly customers update handler
    document.getElementById('update-customers').addEventListener('click', async () => {
        const weeklyCustomers = document.getElementById('weekly-customers').value;
        try {
            const response = await fetch(`${API_BASE}/api/inventory/update-customers`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ weekly_customers: Number(weeklyCustomers) })
            });
            
            if (response.ok) {
                fetchInventory(); // Refresh inventory
            } else {
                alert('Failed to update weekly customers');
            }
        } catch (error) {
            console.error('Error updating weekly customers:', error);
        }
    });

    // Add refresh distribution plan button handler
    document.getElementById('refresh-distribution').addEventListener('click', async () => {
        const refreshButton = document.getElementById('refresh-distribution');
        const originalText = refreshButton.textContent;
        
        try {
            // Disable button and show loading state
            refreshButton.textContent = 'Refreshing...';
            refreshButton.disabled = true;

            const response = await fetch(`${API_BASE}/api/predict`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                updateDistributionPlanTable(data.distribution_plan);
            } else {
                console.error('Failed to refresh distribution plan:', data.error);
                alert('Failed to refresh distribution plan: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error refreshing distribution plan:', error);
            alert('Error refreshing distribution plan. Please try again.');
        } finally {
            // Restore button state
            refreshButton.textContent = originalText;
            refreshButton.disabled = false;
        }
    });

    // === Visitor Prediction Section ===
    const agencySelect = document.getElementById('agency-select');
    const predictionDate = document.getElementById('prediction-date');
    const getPredictionBtn = document.getElementById('get-prediction');
    const predictionResult = document.getElementById('prediction-result');

    // Fetch agencies and populate dropdown
    async function loadAgencies() {
        try {
            const response = await fetch(`${API_BASE}/api/agencies`);
            const data = await response.json();
            if (data.success) {
                agencySelect.innerHTML = '';
                data.agencies.forEach(agency => {
                    const option = document.createElement('option');
                    option.value = agency;
                    option.textContent = agency;
                    agencySelect.appendChild(option);
                });
            } else {
                agencySelect.innerHTML = '<option>Error loading agencies</option>';
            }
        } catch (err) {
            agencySelect.innerHTML = '<option>Error loading agencies</option>';
        }
    }

    // Handle prediction button click
    getPredictionBtn.addEventListener('click', async () => {
        const agency = agencySelect.value;
        const date = predictionDate.value;
        if (!agency || !date) {
            predictionResult.textContent = 'Please select a foodbank and date.';
            return;
        }
        predictionResult.textContent = 'Loading...';
        try {
            const response = await fetch(`${API_BASE}/api/visitor_prediction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agency, date })
            });
            const data = await response.json();
            if (data.success) {
                predictionResult.textContent = `Predicted visitors for ${agency} on ${date}: ${data.predicted_visits}`;
            } else {
                predictionResult.textContent = 'Prediction error: ' + (data.error || 'Unknown error');
            }
        } catch (err) {
            predictionResult.textContent = 'Prediction error: ' + err.message;
        }
    });

    // Load agencies on page load
    loadAgencies();

    // === Tab and Sidebar Navigation ===
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');
    const sidebarLinks = document.querySelectorAll('.sidebar-link');

    function showTab(tabId) {
        tabContents.forEach(tc => tc.style.display = tc.id === tabId ? '' : 'none');
        tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
        sidebarLinks.forEach(l => l.classList.toggle('active', l.dataset.tab === tabId));
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', () => showTab(tab.dataset.tab));
    });
    sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            showTab(link.dataset.tab);
        });
    });
    // Show default tab
    showTab('inventory-tab');

    // === Summary Widgets ===
    const widgetTotalItems = document.getElementById('widget-total-items');
    const widgetExpiringSoon = document.getElementById('widget-expiring-soon');
    const widgetWeeklyVisitors = document.getElementById('widget-weekly-visitors');

    function updateSummaryWidgets(inventoryData) {
        widgetTotalItems.textContent = inventoryData.length;
        // Expiring soon: items with days_until_expiry <= 7
        const expiringSoon = inventoryData.filter(item => item.days_until_expiry <= 7).length;
        widgetExpiringSoon.textContent = expiringSoon;
        // Weekly visitors: sum of weekly_customers
        const totalVisitors = inventoryData.reduce((sum, item) => sum + (item.weekly_customers || 0), 0);
        widgetWeeklyVisitors.textContent = totalVisitors;
    }

    // Patch fetchInventory to update widgets
    const originalFetchInventory = fetchInventory;
    fetchInventory = async function() {
        try {
            const response = await fetch(`${API_BASE}/api/inventory`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const inventoryData = await response.json();
            inventoryBody.innerHTML = "";
            inventoryData.forEach(item => {
                const row = createInventoryRow(item);
                inventoryBody.appendChild(row);
            });
            // Update widgets
            updateSummaryWidgets(inventoryData);
            // Fetch distribution plan
            await fetchDistributionPlan(inventoryData);
        } catch (error) {
            console.error("Failed to load inventory data", error);
        }
    };
});
