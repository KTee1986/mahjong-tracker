/**
 * Fetches the SettleUp groups associated with the logged-in user
 * from a backend endpoint and displays them.
 *
 * Assumes the backend endpoint handles authentication and returns an array like:
 * [ { id: "groupId1", name: "GroupName1" }, { id: "groupId2", name: "GroupName2" } ]
 *
 * @param {HTMLElement} resultsElement - The DOM element to display the group list in.
 * @param {HTMLElement} errorElement - The DOM element to display error messages in.
 * @param {string} [backendUrl='/_functions/getUserGroups'] - Optional: The URL of the backend endpoint.
 */
async function fetchUserGroups(resultsElement, errorElement, backendUrl = '/_functions/getUserGroups') {
    // Validate inputs
    if (!resultsElement || !(resultsElement instanceof HTMLElement)) {
        console.error('Error: Invalid resultsElement provided.');
        // No errorElement to update, as it might also be invalid
        return;
    }
     if (!errorElement || !(errorElement instanceof HTMLElement)) {
        console.error('Error: Invalid errorElement provided.');
        // Cannot display error in the designated element
        if (resultsElement) resultsElement.innerHTML = '<p>Configuration error: Invalid error display element.</p>';
        return;
    }

    // Clear previous state and show loading
    resultsElement.innerHTML = '<p>Loading user groups...</p>';
    errorElement.textContent = '';

    try {
        // Make the request to your backend endpoint
        // No query parameters needed here, as the backend identifies the user
        const response = await fetch(backendUrl);

        if (!response.ok) {
            // Handle HTTP errors (like 401 Unauthorized, 404 Not Found, 500 Server Error)
            let errorText = '';
            try {
                errorText = await response.text(); // Try to get more details
            } catch (e) { /* Ignore if body can't be read */ }
            throw new Error(`Backend error: ${response.status} ${response.statusText}. ${errorText || 'Failed to fetch user groups.'}`);
        }

        const groups = await response.json(); // Assuming the backend returns JSON array

        // Check if the backend indicated an error in the JSON response
        if (groups && typeof groups === 'object' && !Array.isArray(groups) && groups.error) {
             throw new Error(`Backend returned error: ${groups.error}`);
        }

        // Check if the response is an array
        if (!Array.isArray(groups)) {
            console.error('Unexpected response format. Expected an array of groups.', groups);
            throw new Error('Received unexpected data format from the server.');
        }

        // Check if the groups array is empty
        if (groups.length === 0) {
            resultsElement.innerHTML = '<p>No groups found for this user.</p>';
            return;
        }

        // Process and display the groups
        resultsElement.innerHTML = ''; // Clear loading message
        const groupList = document.createElement('ul');
        groupList.style.listStyle = 'none'; // Optional styling
        groupList.style.padding = '0';

        groups.forEach(group => {
            // Basic check if group is an object with id and name
            if (group && typeof group === 'object' && group.id && group.name) {
                const listItem = document.createElement('li');
                listItem.style.marginBottom = '5px'; // Optional styling
                listItem.textContent = `Name: ${group.name}, Group ID: ${group.id}`;
                groupList.appendChild(listItem);
            } else {
                console.warn('Skipping invalid group data entry:', group);
            }
        });

         if (groupList.children.length === 0) {
             resultsElement.innerHTML = '<p>Group data received, but contained no valid entries.</p>';
        } else {
            resultsElement.appendChild(groupList);
        }

    } catch (error) {
        console.error('Fetch error:', error);
        resultsElement.innerHTML = '<p>Could not fetch user groups.</p>';
        errorElement.textContent = `Error: ${error.message}`;
    }
}

// Example of how to use this function (requires an HTML file with elements having ids 'fetch-groups-btn', 'groups-results-area', 'groups-error-area'):
/*
document.addEventListener('DOMContentLoaded', () => {
    const fetchButton = document.getElementById('fetch-groups-btn');
    const resultsDiv = document.getElementById('groups-results-area');
    const errorDiv = document.getElementById('groups-error-area');

    // Check if elements exist before adding listener
    if (fetchButton && resultsDiv && errorDiv) {
        fetchButton.addEventListener('click', () => {
            // Call the function to fetch groups for the currently logged-in user
            fetchUserGroups(resultsDiv, errorDiv);
            // Example with custom URL:
            // fetchUserGroups(resultsDiv, errorDiv, '/my/custom/usergroups/endpoint');
        });
    } else {
         console.error("One or more required HTML elements ('fetch-groups-btn', 'groups-results-area', 'groups-error-area') not found.");
    }
});
*/

// If you are using Node.js or a module bundler, you might export the function:
// export { fetchUserGroups };
// Or for basic script inclusion:
// window.fetchUserGroups = fetchUserGroups;