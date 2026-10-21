<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/** The signed link that proves an email and lets its owner set a password. */
class LoginLink extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public User $user, public string $url, public bool $welcome)
    {
    }

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->welcome ? 'Confirm your email and set your password' : 'Your sign-in link');
    }

    public function content(): Content
    {
        return new Content(view: 'emails.login-link', text: 'emails.login-link-text');
    }
}
