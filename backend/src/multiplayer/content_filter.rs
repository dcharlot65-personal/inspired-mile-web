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

/// Result of AI pattern heuristic check.
pub struct AiCheckResult {
    pub suspicious: bool,
    pub confidence: f32,
    pub indicators: Vec<String>,
}

/// Common AI-generated text indicators.
const AI_PHRASES: &[&str] = &[
    "in conclusion", "let me", "as an ai", "i'd be happy to",
    "it's worth noting", "in summary", "certainly!", "of course!",
    "here's a", "allow me to", "i must say",
];

/// Heuristic check for AI-generated text patterns.
pub fn check_ai_patterns(text: &str) -> AiCheckResult {
    let lower = text.to_lowercase();
    let mut indicators = Vec::new();
    let mut score: f32 = 0.0;

    // Check for common AI phrases
    for &phrase in AI_PHRASES {
        if lower.contains(phrase) {
            indicators.push(format!("Contains AI-typical phrase: '{}'", phrase));
            score += 0.3;
        }
    }

    // Check lexical diversity (unique words / total words)
    let words: Vec<&str> = lower.split_whitespace().collect();
    if words.len() >= 20 {
        let unique: std::collections::HashSet<&str> = words.iter().copied().collect();
        let diversity = unique.len() as f32 / words.len() as f32;
        // AI text for short passages tends to have very high diversity (>0.85)
        if diversity > 0.88 {
            indicators.push(format!("Very high lexical diversity: {:.0}%", diversity * 100.0));
            score += 0.2;
        }
    }

    // Check for suspiciously balanced line lengths (AI tends to produce uniform lines)
    let lines: Vec<&str> = text.lines().filter(|l| !l.trim().is_empty()).collect();
    if lines.len() >= 4 {
        let lengths: Vec<usize> = lines.iter().map(|l| l.trim().len()).collect();
        let avg = lengths.iter().sum::<usize>() as f32 / lengths.len() as f32;
        let variance = lengths.iter().map(|&l| (l as f32 - avg).powi(2)).sum::<f32>() / lengths.len() as f32;
        let std_dev = variance.sqrt();
        // Very low deviation across 4+ lines suggests machine generation
        if std_dev < 3.0 && avg > 30.0 {
            indicators.push(format!("Suspiciously uniform line lengths (std dev: {:.1})", std_dev));
            score += 0.3;
        }
    }

    AiCheckResult {
        suspicious: score >= 0.5,
        confidence: score.min(1.0),
        indicators,
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
