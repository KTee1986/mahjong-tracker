// pages/settleup-members.js
import { useState } from "react";
import Layout from "../components/Layout"; // Assuming you have a Layout component
/**
 * Fetches SettleUp group members from a backend endpoint and displays them.
 *
 * @param {string} groupId - The ID of the SettleUp group to fetch members for.
 * @param {HTMLElement} resultsElement - The DOM element to display the member list in.
 * @param {HTMLElement} errorElement - The DOM element to display error messages in.
 * @param {string} [backendUrl='/_functions/getGroupMembers'] - Optional: The URL of the backend endpoint.
 */
async function fetchGroupMembers(groupId, resultsElement, errorElement, backendUrl = '/_functions/getGroupMembers') {
    // Validate inputs
    if (!groupId || typeof groupId !== 'string' || groupId.trim() === '') {
        if (errorElement) errorElement.textContent = 'Error: Invalid or empty Group ID provided.';
        if (resultsElement) resultsElement.innerHTML = ''; // Clear results area
        console.error('Invalid or empty Group ID provided.');
        return;
    }
    if (!resultsElement || !(resultsElement instanceof HTMLElement)) {
        console.error('Error: Invalid resultsElement provided.');
        // No errorElement to update, as it might also be invalid
        return;
    }
     if (!errorElement || !(errorElement instanceof HTMLElement)) {
        console.error('Error: Invalid errorElement provided.');
        // Cannot display error in the designated element
        resultsElement.innerHTML = '<p>Configuration error: Invalid error display element.</p>';
        return;
    }

    // Clear previous state and show loading
    resultsElement.innerHTML = '<p>Loading...</p>';
    errorElement.textContent = '';

    try {
        // Construct the full URL with the query parameter
        const urlWithQuery = `${backendUrl}?groupId=${encodeURIComponent(groupId)}`;

        // Make the request to your backend endpoint
        const response = await fetch(urlWithQuery);

        if (!response.ok) {
            // Handle HTTP errors (like 404, 500)
            const errorText = await response.text();
            throw new Error(`Backend error: ${response.status} ${response.statusText}. ${errorText || ''}`);
        }

        const members = await response.json(); // Assuming the backend returns JSON

        // Check if the backend indicated an error in the JSON response
        // (assuming the backend might return { error: "message" })
        if (members && typeof members === 'object' && members.error) {
             throw new Error(`Backend returned error: ${members.error}`);
        }

        // Check if the members object is empty or not structured as expected
        if (!members || typeof members !== 'object' || Object.keys(members).length === 0) {
            resultsElement.innerHTML = '<p>No members found for this Group ID, or the data format is unexpected.</p>';
            return;
        }

        // Process and display the members
        resultsElement.innerHTML = ''; // Clear loading message
        const memberList = document.createElement('ul');
        memberList.style.listStyle = 'none'; // Optional styling
        memberList.style.padding = '0';

        // The backend function getGroupMembers returns an object
        // where keys are memberIds and values are member objects {name: ..., active: ...}
        for (const memberId in members) {
            // Ensure it's an own property and not from the prototype chain
            if (Object.prototype.hasOwnProperty.call(members, memberId)) {
                const member = members[memberId];
                // Basic check if member is an object with a name property
                if (member && typeof member === 'object' && typeof member.name !== 'undefined') {
                    const listItem = document.createElement('li');
                    listItem.style.marginBottom = '5px'; // Optional styling
                    listItem.textContent = `Name: ${member.name}, Member ID: ${memberId}, Active: ${member.active}`;
                    memberList.appendChild(listItem);
                } else {
                     console.warn(`Skipping invalid member data for ID: ${memberId}`, member);
                }
            }
        }

        if (memberList.children.length === 0) {
             resultsElement.innerHTML = '<p>Members object received, but contained no valid member entries.</p>';
        } else {
            resultsElement.appendChild(memberList);
        }


    } catch (error) {
        console.error('Fetch error:', error);
        resultsElement.innerHTML = '<p>Could not fetch members.</p>';
        errorElement.textContent = `Error: ${error.message}`;
    }
}

// Example of how to use this function (requires an HTML file with elements having ids 'group-id', 'fetch-btn', 'results-area', 'error-area'):
/*
document.addEventListener('DOMContentLoaded', () => {
    const groupIdInput = document.getElementById('group-id');
    const fetchButton = document.getElementById('fetch-btn');
    const resultsDiv = document.getElementById('results-area');
    const errorDiv = document.getElementById('error-area');

    if (fetchButton && groupIdInput && resultsDiv && errorDiv) {
        fetchButton.addEventListener('click', () => {
            const groupId = groupIdInput.value;
            fetchGroupMembers(groupId, resultsDiv, errorDiv); // Optionally pass a different backend URL as the 4th argument
        });
    } else {
        console.error("One or more required HTML elements ('group-id', 'fetch-btn', 'results-area', 'error-area') not found.");
    }
});
*/

// If you are using Node.js or a module bundler, you might export the function:
// export { fetchGroupMembers };
// Or for basic script inclusion:
// window.fetchGroupMembers = fetchGroupMembers;