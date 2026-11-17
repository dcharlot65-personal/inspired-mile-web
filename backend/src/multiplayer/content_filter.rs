/// Basic content moderation filter for multiplayer UGC (battle verses).
/// Checks for profanity, slurs, and threatening language.

// Blocked terms — kept deliberately short and targeted.
// These are checked as whole-word boundaries to avoid false positives.
const BLOCKED_WORDS: &[&str] = &[
    "fuck", "shit", "bitch", "asshole", "cunt", "dick", "cock", "pussy",
    "nigger", "nigga", "faggot", "retard", "kike", "spic", "chink", "wetback",
    "kill yourself", "kys", "hang yourself", "go die",
];

/// Result of content moderation check.
pub struct FilterResult {
    pub allowed: bool,
    pub reason: Option<String>,
}

/// Check if text passes the content filter.
/// Returns `FilterResult` with allowed=true if clean, or allowed=false with a reason.
pub fn check_content(text: &str) -> FilterResult {
    let lower = text.to_lowercase();

    for &word in BLOCKED_WORDS {
        if word.contains(' ') {
            // Multi-word phrase: direct substring match
            if lower.contains(word) {
                return FilterResult {
                    allowed: false,
                    reason: Some("Your verse contains language that violates our community guidelines. Please revise and resubmit.".into()),
                };
            }
        } else {
            // Single word: check word boundaries
            for token in lower.split(|c: char| !c.is_alphanumeric()) {
                if token == word {
                    return FilterResult {
                        allowed: false,
                        reason: Some("Your verse contains language that violates our community guidelines. Please revise and resubmit.".into()),
                    };
                }
            }
        }
    }

    FilterResult {
        allowed: true,
        reason: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allows_clean_text() {
        let r = check_content("To be or not to be, that is the question");
        assert!(r.allowed);
    }

    #[test]
    fn blocks_profanity() {
        let r = check_content("What the fuck is this");
        assert!(!r.allowed);
    }

    #[test]
    fn blocks_slurs() {
        let r = check_content("You are a retard");
        assert!(!r.allowed);
    }

    #[test]
    fn blocks_threats() {
        let r = check_content("go kill yourself");
        assert!(!r.allowed);
    }

    #[test]
    fn no_false_positive_on_substrings() {
        // "assassin" contains "ass" but should not be blocked
        let r = check_content("The assassin crept through the castle");
        assert!(r.allowed);
    }

    #[test]
    fn case_insensitive() {
        let r = check_content("FUCK this");
        assert!(!r.allowed);
    }
}
