const loginForm = document.getElementById("login-form");
const errorMessage = document.getElementById("error-message");

if (loginForm) {
	loginForm.addEventListener("submit", async (e) => {
		e.preventDefault();

		const email = document.getElementById("email").value;
		const password = document.getElementById("password").value;

		try {
			const response = await fetch("/api/auth/login", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "same-origin",
				body: JSON.stringify({ email, password }),
			});

			const data = await response.json();

			if (data.success) {
				window.location.href = "/";
			} else {
				errorMessage.style.display = "block";
				errorMessage.textContent =
					data.error ||
					"Invalid email or password. Please try again.";
			}
		} catch (error) {
			console.error("Login error:", error);
			errorMessage.style.display = "block";
			errorMessage.textContent = "An error occurred. Please try again.";
		}
	});
}
