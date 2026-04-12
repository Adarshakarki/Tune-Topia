// Login
const $ = (id) => document.getElementById(id);

export function render() {
  const body = $('login-content');
  if (!body) return;

  body.innerHTML = `
    <div class="login-container">
      <div class="production-warning">
        <i class="bi bi-cone-striped"></i>
        <span>Feature under development</span>
      </div>

      <!-- Tabs -->
      <div class="login-tabs">
        <button class="login-tab active" id="tab-signin" onclick="switchTab('signin')">Sign In</button>
        <button class="login-tab" id="tab-signup" onclick="switchTab('signup')">Sign Up</button>
      </div>

      <!-- Sign In -->
      <div class="login-form" id="form-signin">
        <div class="login-field">
          <label>Email or Username</label>
          <input type="email" class="settings-input" placeholder="Enter your email" disabled />
        </div>
        <div class="login-field">
          <label>Password</label>
          <input type="password" class="settings-input" placeholder="Enter your password" disabled />
        </div>
        <div class="login-forgot">
          <a href="#">Forgot password?</a>
        </div>
        <button class="settings-save-btn" style="width:100%; margin-top:var(--s2)" disabled>Sign In</button>
        <div class="login-divider"><span>or</span></div>
        <button class="settings-save-btn settings-cancel-btn" style="width:100%" disabled>
          <i class="bi bi-google"></i> Continue with Google
        </button>
      </div>

      <!-- Sign Up -->
      <div class="login-form" id="form-signup" style="display:none;">
        <div class="login-field">
          <label>Username</label>
          <input type="text" class="settings-input" placeholder="Choose a username" disabled />
        </div>
        <div class="login-field">
          <label>Email</label>
          <input type="email" class="settings-input" placeholder="Enter your email" disabled />
        </div>
        <div class="login-field">
          <label>Password</label>
          <input type="password" class="settings-input" placeholder="Create a password" disabled />
        </div>
        <div class="login-field">
          <label>Confirm Password</label>
          <input type="password" class="settings-input" placeholder="Repeat your password" disabled />
        </div>
        <button class="settings-save-btn" style="width:100%; margin-top:var(--s2)" disabled>Create Account</button>
        <div class="login-divider"><span>or</span></div>
        <button class="settings-save-btn settings-cancel-btn" style="width:100%" disabled>
          <i class="bi bi-google"></i> Sign Up with Google
        </button>
      </div>

    </div>
  `;

  window.switchTab = function (tab) {
    const signinForm = $('form-signin');
    const signupForm = $('form-signup');
    const tabSignin  = $('tab-signin');
    const tabSignup  = $('tab-signup');

    if (tab === 'signin') {
      signinForm.style.display = 'flex';
      signupForm.style.display = 'none';
      tabSignin.classList.add('active');
      tabSignup.classList.remove('active');
    } else {
      signinForm.style.display = 'none';
      signupForm.style.display = 'flex';
      tabSignin.classList.remove('active');
      tabSignup.classList.add('active');
    }
  };
}