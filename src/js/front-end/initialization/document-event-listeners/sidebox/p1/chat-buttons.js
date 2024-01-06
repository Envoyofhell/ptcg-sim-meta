import { resetCounters } from "../../../../actions/counters/reset-ability-counters.js";
import { discardBoard } from "../../../../actions/general/board-actions.js";
import { systemState } from "../../../../front-end.js";
import { appendMessage } from "../../../../setup/chatbox/messages.js";
import { determineUsername } from "../../../../setup/general/determine-username.js";

export const initializeP1ChatButtons = () => {
    const attackButton = document.getElementById('attackButton');
    attackButton.addEventListener('click', () => {
        resetCounters();
        const user = systemState.pov.user;
        const message = determineUsername(user) + ' attacked';
        appendMessage(user, message, 'player');
        discardBoard(user, false);
    });

    const passButton = document.getElementById('passButton');
    passButton.addEventListener('click', () => {
        resetCounters();
        const user = systemState.pov.user;
        const message = determineUsername(user) + ' passed';
        appendMessage(user, message, 'player');
        discardBoard(user, false);
    });

    const messageInput = document.getElementById('messageInput');
    messageInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            const message = messageInput.value.trim();
            if (message !== '') {
                appendMessage(systemState.pov.user, determineUsername(systemState.pov.user) + ': ' + message, 'message');
                messageInput.value = '';
            };
        };
    });

    const FREEBUTTON = document.getElementById('FREEBUTTON');
    FREEBUTTON.addEventListener('click', () => {
        appendMessage(systemState.pov.user, FREEBUTTON.textContent, 'player');
    });
};