resource "aws_s3_bucket" "files" {
  bucket = "chatbot-files-bucket"
  force_destroy = true
  # Add encryption, versioning, etc. as needed
}

resource "aws_s3_bucket" "user_feedback" {
  bucket = "chatbot-user-feedback-bucket"
  force_destroy = true
}