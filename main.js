const quizContainer = document.getElementById("quiz-container");
let categories = [];
let questions = [];
let currentIndex = 0;
let score = 0;
let userAnswers = [];
let timerInterval;
let timeLeft = 15;
let selectedCategory = null;
let selectedDifficulty = null;
let questionAmount = 5;

// Fetch available categories from OpenTDB
async function fetchCategories() {
  try {
    const res = await fetch('https://opentdb.com/api_category.php');
    const data = await res.json();
    categories = data.trivia_categories;
    renderStartScreen();
  } catch (error) {
    showError("Failed to load categories. Please check your connection and reload.");
  }
}

// Render the start screen with dropdowns
function renderStartScreen() {
  quizContainer.innerHTML = `
    <h2 class="mb-4 text-center">Start Quiz</h2>
    <form id="start-form" class="mb-3">
      <div class="mb-3">
        <label for="category" class="form-label">Category</label>
        <select class="form-select" id="category" required>
          <option value="">Select a category</option>
          ${categories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('')}
        </select>
      </div>
      <div class="mb-3">
        <label for="difficulty" class="form-label">Difficulty</label>
        <select class="form-select" id="difficulty" required>
          <option value="">Select difficulty</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
      </div>
      <div class="mb-3">
        <label for="amount" class="form-label">Number of Questions</label>
        <input type="number" class="form-control" id="amount" min="3" max="20" value="5" required>
      </div>
      <button type="submit" class="btn btn-primary w-100">Start Quiz</button>
    </form>
  `;
  document.getElementById("start-form").addEventListener("submit", (e) => {
    e.preventDefault();
    selectedCategory = document.getElementById("category").value;
    selectedDifficulty = document.getElementById("difficulty").value;
    questionAmount = Math.max(3, Math.min(20, parseInt(document.getElementById("amount").value)));
    fetchQuiz();
  });
}

// Fetch quiz questions from OpenTDB
async function fetchQuiz() {
  quizContainer.innerHTML = `
    <div class="text-center my-5">
      <div class="spinner-border text-primary" role="status"></div>
      <div class="mt-2">Loading quiz...</div>
    </div>
  `;
  currentIndex = 0;
  score = 0;
  userAnswers = [];
  let url = `https://opentdb.com/api.php?amount=${questionAmount}&type=multiple`;
  if (selectedCategory) url += `&category=${selectedCategory}`;
  if (selectedDifficulty) url += `&difficulty=${selectedDifficulty}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!data.results || data.results.length === 0) {
      throw new Error("No questions found for this selection.");
    }
    questions = data.results.map(q => {
      const options = [...q.incorrect_answers];
      const correctIndex = Math.floor(Math.random() * 4);
      options.splice(correctIndex, 0, q.correct_answer);
      return {
        question: decodeHTML(q.question),
        options: options.map(decodeHTML),
        correct: decodeHTML(q.correct_answer)
      };
    });
    renderQuestion();
  } catch (error) {
    showError("Failed to load quiz questions. Try a different category/difficulty or check connection.");
  }
}

function decodeHTML(html) {
  const txt = document.createElement("textarea");
  txt.innerHTML = html;
  return txt.value;
}

function renderQuestion() {
  clearInterval(timerInterval);
  timeLeft = 15;
  const current = questions[currentIndex];
  quizContainer.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-2">
      <div class="timer" id="timer">Time left: ${timeLeft}s</div>
      <div class="fw-bold">Score: ${score}</div>
    </div>
    <div class="progress mb-3">
      <div class="progress-bar" role="progressbar" style="width: ${(currentIndex/questionAmount)*100}%" aria-valuenow="${currentIndex}" aria-valuemin="0" aria-valuemax="${questionAmount}"></div>
    </div>
    <div class="mb-2 text-muted">Question ${currentIndex + 1} of ${questionAmount}</div>
    <div class="question mb-3">${current.question}</div>
    <div id="options" class="mb-3">
      ${current.options.map(opt => `
        <button class="btn btn-outline-dark option-btn mb-2" data-answer="${opt}">${opt}</button>
      `).join("")}
    </div>
    <div class="d-flex gap-2">
      <button class="btn btn-primary flex-fill next-btn"${currentIndex === questions.length - 1 ? ' disabled' : ''}>Next</button>
      <button class="btn btn-success flex-fill finish-btn"${currentIndex === questions.length - 1 ? '' : ' disabled'}>Finish Quiz</button>
    </div>
  `;

  const optionButtons = document.querySelectorAll(".option-btn");
  const nextBtn = document.querySelector(".next-btn");
  const finishBtn = document.querySelector(".finish-btn");

  let answered = false;

  optionButtons.forEach(button => {
    button.addEventListener("click", () => {
      if (answered) return;
      answered = true;
      clearInterval(timerInterval);
      optionButtons.forEach(b => b.disabled = true);
      const selected = button.getAttribute("data-answer");
      const correct = current.correct;

      if (selected === correct) {
        button.classList.add("correct");
        score++;
      } else {
        button.classList.add("incorrect");
        optionButtons.forEach(b => {
          if (b.getAttribute("data-answer") === correct) {
            b.classList.add("correct");
          }
        });
      }

      userAnswers.push({ question: current.question, selected, correct });

      // Enable Next and Finish buttons after answering
      if (currentIndex !== questions.length - 1) {
        nextBtn.disabled = false;
        finishBtn.disabled = true;
      } else {
        nextBtn.disabled = true;
        finishBtn.disabled = false;
      }
    });
  });

  nextBtn.addEventListener("click", () => {
    if (!answered) {
      autoSubmitAnswer();
      answered = true;
    }
    currentIndex++;
    if (currentIndex < questions.length) {
      renderQuestion();
    }
  });

  finishBtn.addEventListener("click", () => {
    if (!answered) {
      autoSubmitAnswer();
      answered = true;
    }
    showResult();
  });

  // Initial button states
  if (currentIndex !== questions.length - 1) {
    nextBtn.disabled = true;
    finishBtn.disabled = true;
  } else {
    nextBtn.disabled = true;
    finishBtn.disabled = true;
  }

  startTimer();
}

function startTimer() {
  const timerEl = document.getElementById("timer");
  timerInterval = setInterval(() => {
    timeLeft--;
    timerEl.textContent = `Time left: ${timeLeft}s`;
    if (timeLeft <= 5) {
      timerEl.classList.add("danger");
    }
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      autoSubmitAnswer();
    }
  }, 1000);
}

function autoSubmitAnswer() {
  const current = questions[currentIndex];
  const correct = current.correct;
  const optionButtons = document.querySelectorAll(".option-btn");
  optionButtons.forEach(b => {
    b.disabled = true;
    if (b.getAttribute("data-answer") === correct) {
      b.classList.add("correct");
    }
  });
  userAnswers.push({ question: current.question, selected: "Not answered", correct });

  // Enable/disable Next and Finish based on question index
  const nextBtn = document.querySelector(".next-btn");
  const finishBtn = document.querySelector(".finish-btn");
  if (currentIndex !== questions.length - 1) {
    nextBtn.disabled = false;
    finishBtn.disabled = true;
  } else {
    nextBtn.disabled = true;
    finishBtn.disabled = false;
  }
}

function showResult() {
  clearInterval(timerInterval);
  quizContainer.innerHTML = `
    <h2 class="mb-3 text-center">Quiz Completed!</h2>
    <div class="alert alert-info text-center mb-4">
      You scored <strong>${score}</strong> out of <strong>${questions.length}</strong>
    </div>
    <div class="accordion mb-4" id="resultsAccordion">
      ${userAnswers.map((ans, i) => `
        <div class="accordion-item">
          <h2 class="accordion-header" id="heading${i}">
            <button class="accordion-button collapsed ${ans.selected !== ans.correct ? 'text-danger' : 'text-success'}" type="button" data-bs-toggle="collapse" data-bs-target="#collapse${i}" aria-expanded="false" aria-controls="collapse${i}">
              Q${i+1}: ${ans.selected === ans.correct ? 'Correct' : 'Incorrect'}
            </button>
          </h2>
          <div id="collapse${i}" class="accordion-collapse collapse" aria-labelledby="heading${i}" data-bs-parent="#resultsAccordion">
            <div class="accordion-body">
              <div class="mb-2"><strong>Question:</strong> ${ans.question}</div>
              <div class="mb-2"><strong>Your answer:</strong> ${ans.selected}</div>
              <div><strong>Correct answer:</strong> ${ans.correct}</div>
            </div>
          </div>
        </div>
      `).join("")}
    </div>
    <button class="btn btn-dark w-100 retake-btn">Retake Quiz</button>
  `;
  document.querySelector(".retake-btn").addEventListener("click", () => {
    renderStartScreen();
  });
}

function showError(message) {
  quizContainer.innerHTML = `
    <div class="alert alert-danger text-center my-5">
      <div class="mb-2"><strong>Error:</strong></div>
      <div>${message}</div>
      <button class="btn btn-outline-primary mt-3" onclick="location.reload()">Reload</button>
    </div>
  `;
}

// Start by fetching categories
fetchCategories();
