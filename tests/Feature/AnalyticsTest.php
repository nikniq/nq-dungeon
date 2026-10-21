<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AnalyticsTest extends TestCase
{
    use RefreshDatabase;

    public function test_no_tag_without_a_measurement_id(): void
    {
        config(['services.google_analytics.measurement_id' => null]);
        $this->get('/')->assertOk()->assertDontSee('googletagmanager.com');
    }

    public function test_tag_on_every_page_with_a_measurement_id(): void
    {
        config(['services.google_analytics.measurement_id' => 'G-TEST1234']);
        foreach (['/', '/play', '/heroes', '/login', '/register'] as $url) {
            $this->get($url)->assertOk()->assertSee('googletagmanager.com/gtag/js?id=G-TEST1234', false)->assertSee("gtag('config', \"G-TEST1234\")", false);
        }
    }

    public function test_malformed_ids_are_ignored(): void
    {
        config(['services.google_analytics.measurement_id' => 'G-1"><script>alert(1)</script>']);
        $this->get('/')->assertOk()->assertDontSee('googletagmanager.com')->assertDontSee('alert(1)', false);
    }

    public function test_sign_up_sends_a_one_off_event(): void
    {
        config(['services.google_analytics.measurement_id' => 'G-TEST1234']);
        \Illuminate\Support\Facades\Mail::fake();
        $this->post('/register', ['character' => 'Ayla', 'email' => 'a@example.com', 'class' => 'mage'])->assertOk();
        $this->get(\App\Http\Controllers\AuthController::linkFor(\App\Models\User::where('email', 'a@example.com')->first()))->assertRedirect('/password');
        $this->post('/password', ['password' => 'password123', 'password_confirmation' => 'password123'])->assertRedirect('/play');
        $this->get('/play')->assertSee("gtag('event', \"sign_up\"", false)->assertSee('"hero_class":"mage"', false);
        $this->get('/play')->assertDontSee("gtag('event', \"sign_up\"", false);
    }
}
