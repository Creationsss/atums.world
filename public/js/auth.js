const loginForm = document.getElementById("login-form");
const errorMessage = document.getElementById("error-message");
const rememberMe = document.getElementById("remember-me");
const emailInput = document.getElementById("email");

if (emailInput && localStorage.getItem("email")) {
	emailInput.value = localStorage.getItem("email");
}

if (loginForm) {
	loginForm.addEventListener("submit", async (e) => {
		e.preventDefault();

		const email = emailInput?.value.trim();
		const password = document.getElementById("password")?.value.trim();

		if (!email || !password) {
			if (errorMessage) {
				errorMessage.style.display = "block";
				errorMessage.textContent =
					"Please enter both email and password.";
			}
			return;
		}

		if (rememberMe?.checked) {
			localStorage.setItem("email", email);
		} else {
			sessionStorage.setItem("email", email);
		}

		try {
			const response = await fetch("/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "same-origin",
				body: JSON.stringify({ email, password }),
			});

			const data = await response.json();

			if (data.success) {
				window.location.href = "/";
			} else {
				if (errorMessage) {
					errorMessage.style.display = "block";
					errorMessage.textContent =
						data.error ||
						"Invalid email or password. Please try again.";
				}
			}
		} catch (error) {
			console.error("Login error:", error);
			if (errorMessage) {
				errorMessage.style.display = "block";
				errorMessage.textContent =
					"An error occurred. Please try again.";
			}
		}
	});
}

const passwordInput = document.getElementById("password");
const togglePassword = document.getElementById("toggle-password");

togglePassword.addEventListener("click", () => {
	if (passwordInput.type === "password") {
		passwordInput.type = "text";
		togglePassword.innerHTML =
			'<path d="M12 4.5c-5 0-9.27 3.11-11 7.5 1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zm0 13c-3.03 0-5.5-2.47-5.5-5.5s2.47-5.5 5.5-5.5 5.5 2.47 5.5 5.5-2.47 5.5-5.5 5.5z"/>';
	} else {
		passwordInput.type = "password";
		togglePassword.innerHTML =
			'<path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zm0 13c-3.03 0-5.5-2.47-5.5-5.5s2.47-5.5 5.5-5.5 5.5 2.47 5.5 5.5-2.47 5.5-5.5 5.5zm0-9a3.5 3.5 0 100 7 3.5 3.5 0 000-7z"/>';
	}
});
